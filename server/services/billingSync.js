import User from "../models/User.js";
import { getTierFromStripePriceId } from "../constants/billingPlans.js";

/**
 * @param {import("stripe").Stripe.Subscription} subscription
 * @returns {Promise<import("mongoose").Document | null>}
 */
async function findUserForSubscription(subscription) {
	const metaUid = subscription.metadata?.userId;
	if (metaUid) {
		const u = await User.findById(metaUid).exec();
		if (u) return u;
	}
	const cid = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
	if (cid) {
		const u = await User.findOne({ "billing.stripeCustomerId": cid }).exec();
		if (u) return u;
	}
	const sid = subscription.id;
	if (sid) {
		const u = await User.findOne({ "billing.stripeSubscriptionId": sid }).exec();
		if (u) return u;
	}
	return null;
}

/**
 * @param {import("stripe").Stripe.Subscription} subscription
 */
export async function syncUserFromSubscription(subscription) {
	const user = await findUserForSubscription(subscription);
	if (!user) {
		// eslint-disable-next-line no-console
		console.warn("billingSync: no user for subscription", subscription.id);
		return;
	}

	const priceId = subscription.items?.data?.[0]?.price?.id;
	const tierFromPrice = getTierFromStripePriceId(priceId);
	const status = subscription.status;

	const customerId =
		typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || "";

	if (status === "incomplete") {
		user.billing = user.billing || {};
		user.billing.stripeCustomerId = customerId || user.billing.stripeCustomerId;
		user.billing.stripeSubscriptionId = subscription.id;
		user.billing.subscriptionStatus = status;
		await user.save();
		return;
	}

	if (status === "active" || status === "trialing") {
		user.billing = user.billing || {};
		user.billing.stripeCustomerId = customerId || user.billing.stripeCustomerId;
		user.billing.stripeSubscriptionId = subscription.id;
		user.billing.subscriptionStatus = status;
		user.billing.currentPeriodEnd = subscription.current_period_end
			? new Date(subscription.current_period_end * 1000)
			: null;
		user.billing.tier = tierFromPrice || user.billing.tier || "free";
		await user.save();
		return;
	}

	if (status === "canceled" || status === "unpaid" || status === "incomplete_expired" || status === "paused") {
		user.billing = user.billing || {};
		user.billing.stripeSubscriptionId = "";
		user.billing.subscriptionStatus = status;
		user.billing.currentPeriodEnd = null;
		user.billing.tier = "free";
		await user.save();
		return;
	}

	// past_due, incomplete, etc. — keep tier but record status for portal / UX
	user.billing = user.billing || {};
	user.billing.stripeCustomerId = customerId || user.billing.stripeCustomerId;
	user.billing.stripeSubscriptionId = subscription.id;
	user.billing.subscriptionStatus = status;
	user.billing.currentPeriodEnd = subscription.current_period_end
		? new Date(subscription.current_period_end * 1000)
		: null;
	if (tierFromPrice) user.billing.tier = tierFromPrice;
	await user.save();
}

/**
 * @param {string} userId
 * @param {string} customerId
 * @param {string} subscriptionId
 */
export async function linkCheckoutSessionToUser(userId, customerId, subscriptionId) {
	if (!userId || !customerId) return;
	const user = await User.findById(userId).exec();
	if (!user) return;
	user.billing = user.billing || {};
	user.billing.stripeCustomerId = customerId;
	if (subscriptionId) user.billing.stripeSubscriptionId = subscriptionId;
	await user.save();
}
