import cron from "node-cron";
import Quest from "../models/Quest.js";
import { computeQuestExpiry } from "../utils/timeframePeriod.js";

// Every day at 00:00 server time
cron.schedule("0 0 * * *", async () => {
	try {
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayEnd = new Date();
		todayEnd.setHours(23, 59, 59, 999);
		// reset only today's daily quests (in case some are pre-seeded daily)
		await Quest.updateMany(
			{ type: "daily", date: { $gte: todayStart, $lte: todayEnd } },
			{ $set: { isCompleted: false } }
		);
		// eslint-disable-next-line no-console
		console.log("🕛 Daily quest reset executed");
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error("Cron job error:", err);
	}
});

// Every minute: mark expired quests and backfill missing expiresAt
cron.schedule("* * * * *", async () => {
	try {
		const now = new Date();
		// Backfill expiresAt if missing for active timeframe quests
		const cursor = Quest.find({
			type: { $in: ["daily", "weekly", "monthly"] },
			expiresAt: { $in: [null, undefined] },
		}).cursor();
		for await (const q of cursor) {
			q.expiresAt = computeQuestExpiry(q.type, q.date || q.createdAt || now);
			await q.save();
		}		// Expire overdue quests that are not completed or already expired
		const res = await Quest.updateMany(
			{
				type: { $in: ["daily", "weekly", "monthly"] },
				isExpired: false,
				isCompleted: { $ne: true },
				expiresAt: { $lte: now },
			},
			{ $set: { isExpired: true, expiredAt: now } }
		);
		if (res.modifiedCount > 0) {
			// eslint-disable-next-line no-console
			console.log(`⏰ Auto-expired ${res.modifiedCount} quest(s)`);
		}
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error("Cron expire job error:", err);
	}
});
