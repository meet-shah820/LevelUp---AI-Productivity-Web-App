import cron from "node-cron";
import Quest from "../models/Quest.js";

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
