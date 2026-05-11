import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const WS_PATH = "/ws/leaderboard";

/** @type {WebSocketServer | null} */
let wss = null;
let debounceTimer = null;
const DEBOUNCE_MS = 450;

function broadcastLeaderboardUpdated() {
	if (!wss) return;
	const msg = JSON.stringify({ type: "leaderboard_updated" });
	for (const client of wss.clients) {
		if (client.readyState === 1) client.send(msg);
	}
}

/**
 * Debounced notify so rapid XP writes (e.g. bonuses) send one push to all subscribers.
 */
export function scheduleLeaderboardBroadcast() {
	if (!wss) return;
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		debounceTimer = null;
		broadcastLeaderboardUpdated();
	}, DEBOUNCE_MS);
}

/**
 * @param {import("http").Server} server
 */
export function attachLeaderboardWebSocket(server) {
	wss = new WebSocketServer({ noServer: true });

	server.on("upgrade", (req, socket, head) => {
		let pathname = "";
		try {
			const rawPath = new URL(req.url || "", "http://localhost").pathname;
			pathname = rawPath.replace(/\/+$/, "") || "/";
		} catch {
			socket.destroy();
			return;
		}
		if (pathname.toLowerCase() !== WS_PATH) {
			socket.destroy();
			return;
		}

		let token = "";
		try {
			const u = new URL(req.url || "", "http://localhost");
			token = u.searchParams.get("token") || "";
		} catch {
			socket.destroy();
			return;
		}
		if (!token) {
			socket.destroy();
			return;
		}

		let uid;
		try {
			const payload = jwt.verify(token, JWT_SECRET);
			uid = payload?.uid;
			if (!uid) throw new Error("missing uid");
		} catch {
			socket.destroy();
			return;
		}

		User.findById(uid)
			.select("googleId")
			.lean()
			.then((u) => {
				if (!u?.googleId) {
					socket.destroy();
					return;
				}
				wss.handleUpgrade(req, socket, head, (ws) => {
					wss.emit("connection", ws, req);
				});
			})
			.catch(() => {
				socket.destroy();
			});
	});

	wss.on("connection", (ws) => {
		ws.send(JSON.stringify({ type: "connected" }));
	});

	return wss;
}
