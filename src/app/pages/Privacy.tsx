import { Link } from "react-router-dom";
import { LegalDocumentShell } from "../components/legal/LegalDocumentShell";

const SITE_URL = "https://levelup-productivity-web-app.vercel.app";

export default function Privacy() {
	return (
		<LegalDocumentShell title="🛡️ PRIVACY POLICY – LevelUp" metaLine="Last Updated: June 23, 2026">
			<section className="space-y-3">
				<h2>1. Introduction</h2>
				<p>
					Welcome to LevelUp (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;). We respect your privacy and are committed to protecting your
					personal data.
				</p>
				<p>This Privacy Policy explains how we collect, use, and safeguard your information when you use:</p>
				<p>
					<span className="mr-1" aria-hidden>
						👉
					</span>
					<a href={SITE_URL} className="text-indigo-400 underline-offset-2 hover:underline break-all">
						{SITE_URL}
					</a>
				</p>
				<p>
					For details about cookies and similar technologies, see our{" "}
					<Link to="/legal/cookies">Cookie Policy</Link>.
				</p>
			</section>

			<section className="space-y-3">
				<h2>2. Information We Collect</h2>
				<h3 className="text-gray-200 text-sm font-medium">Account &amp; profile information</h3>
				<p>When you create or use an account, we may collect:</p>
				<ul>
					<li>Username and display name</li>
					<li>Email address (including when you sign in with Google)</li>
					<li>Profile information you choose to provide (for example bio or avatar)</li>
					<li>Training goals, quests, streaks, achievements, XP, and Hunter rank progress</li>
					<li>Referral codes you use or share</li>
				</ul>
				<h3 className="text-gray-200 text-sm font-medium pt-2">Payment information</h3>
				<p>Payments are processed securely through Stripe. We do <strong className="text-gray-200">not</strong> store your full card details.</p>
				<p>
					Stripe&apos;s own policies apply when you pay:{" "}
					<a
						href="https://stripe.com/privacy"
						target="_blank"
						rel="noopener noreferrer"
						className="text-indigo-400 underline-offset-2 hover:underline"
					>
						Stripe Privacy
					</a>
					{" · "}
					<a
						href="https://stripe.com/legal"
						target="_blank"
						rel="noopener noreferrer"
						className="text-indigo-400 underline-offset-2 hover:underline"
					>
						Stripe Legal
					</a>
				</p>
				<h3 className="text-gray-200 text-sm font-medium pt-2">Usage &amp; analytics information</h3>
				<p>
					When analytics is enabled in our production environment, we use <strong className="text-gray-200">PostHog</strong> to
					understand how the Service is used and to improve it. This may include:
				</p>
				<ul>
					<li>Pages and features you visit or interact with</li>
					<li>Product events (for example sign-up, goal creation, quest completion, subscription checkout)</li>
					<li>Device, browser, and approximate location derived from IP address</li>
					<li>Session recordings of in-app interactions, with form inputs masked by default</li>
					<li>A persistent analytics identifier linked to your account after you sign in</li>
				</ul>
				<p>
					We configure PostHog to build detailed user profiles only for signed-in users. Anonymous visitors may still receive a
					temporary analytics identifier.
				</p>
			</section>

			<section className="space-y-3">
				<h2>3. How We Use Your Information</h2>
				<p>We use your data to:</p>
				<ul>
					<li>Create and manage your account</li>
					<li>Provide fitness training, quests, streaks, achievements, referrals, and related features</li>
					<li>Process subscriptions and billing through Stripe</li>
					<li>Measure product usage, diagnose issues, and improve performance and user experience</li>
					<li>Communicate with you about the Service when necessary</li>
					<li>Protect the Service against abuse, fraud, and security incidents</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>4. Cookies, Local Storage &amp; Tracking</h2>
				<p>
					We use cookies, local storage, and similar browser technologies to operate LevelUp and, where configured, to measure
					usage.
				</p>
				<ul>
					<li>
						<strong className="text-gray-200">Strictly necessary:</strong> keeping you signed in, securing sessions, and
						storing onboarding or referral state needed for the Service to work.
					</li>
					<li>
						<strong className="text-gray-200">Functional:</strong> preferences you set in the app (for example notification
						or UI choices).
					</li>
					<li>
						<strong className="text-gray-200">Analytics:</strong> PostHog cookies and identifiers used to understand product
						usage, page views, feature adoption, and session replays. We do <strong className="text-gray-200">not</strong>{" "}
						use Google Analytics.
					</li>
				</ul>
				<p>
					See our <Link to="/legal/cookies">Cookie Policy</Link> for a more detailed breakdown and instructions for managing
					cookies in your browser.
				</p>
			</section>

			<section className="space-y-3">
				<h2>5. Data Sharing</h2>
				<p>We do <strong className="text-gray-200">not</strong> sell your personal data.</p>
				<p>We share data only with service providers that help us run LevelUp, including:</p>
				<ul>
					<li>
						<strong className="text-gray-200">Stripe</strong> — payment processing and subscription management
					</li>
					<li>
						<strong className="text-gray-200">PostHog</strong> — product analytics, event tracking, and session replay (
						<a
							href="https://posthog.com/privacy"
							target="_blank"
							rel="noopener noreferrer"
							className="text-indigo-400 underline-offset-2 hover:underline"
						>
							PostHog Privacy Policy
						</a>
						)
					</li>
					<li>
						<strong className="text-gray-200">Google</strong> — if you choose &quot;Continue with Google&quot; for
						authentication (
						<a
							href="https://policies.google.com/privacy"
							target="_blank"
							rel="noopener noreferrer"
							className="text-indigo-400 underline-offset-2 hover:underline"
						>
							Google Privacy Policy
						</a>
						)
					</li>
					<li>
						<strong className="text-gray-200">Hosting &amp; infrastructure providers</strong> — to deliver the website and
						API (for example Vercel and our database host)
					</li>
				</ul>
				<p>
					These providers process data on our behalf under their own terms and privacy policies. We share only what is needed
					for them to provide their services.
				</p>
			</section>

			<section className="space-y-3">
				<h2>6. International Data Transfers</h2>
				<p>
					LevelUp may be operated from Canada. Our service providers may process data in the United States or other
					countries. Where required by law, we rely on appropriate safeguards for cross-border transfers.
				</p>
			</section>

			<section className="space-y-3">
				<h2>7. Data Retention</h2>
				<p>We keep your account and training data while your account is active.</p>
				<p>
					Analytics data retained by PostHog is governed by our PostHog project settings and PostHog&apos;s policies. You may
					request deletion of your account data as described below.
				</p>
			</section>

			<section className="space-y-3">
				<h2>8. Your Rights &amp; Choices</h2>
				<p>Depending on where you live, you may have the right to:</p>
				<ul>
					<li>Access the personal data we hold about you</li>
					<li>Request correction of inaccurate data</li>
					<li>Request deletion of your account and associated data</li>
					<li>Object to or restrict certain processing</li>
					<li>Withdraw consent where processing is based on consent</li>
				</ul>
				<p>You can also:</p>
				<ul>
					<li>Delete your account from in-app Settings where available</li>
					<li>Change analytics preferences under Settings → Legal &amp; policies → Cookie preferences</li>
					<li>Block or clear cookies and local storage through your browser (this may affect sign-in and app functionality)</li>
					<li>Use browser privacy extensions or settings that limit analytics tracking</li>
				</ul>
				<p>
					To exercise your rights or request help with analytics opt-out, contact:{" "}
					<span aria-hidden>📧</span>{" "}
					<a href="mailto:shahmeet8210@gmail.com" className="text-indigo-400 underline-offset-2 hover:underline">
						shahmeet8210@gmail.com
					</a>
				</p>
			</section>

			<section className="space-y-3">
				<h2>9. Security</h2>
				<p>
					We take reasonable technical and organizational steps to protect your data, including encrypted connections (HTTPS)
					and access controls on our servers. No method of transmission or storage is 100% secure.
				</p>
			</section>

			<section className="space-y-3">
				<h2>10. Children&apos;s Privacy</h2>
				<p>
					LevelUp is intended for a general audience and is not directed at children under 13 (or the minimum age required in
					your jurisdiction). We do not knowingly collect personal data from children. If you believe a child has provided us
					data, contact us and we will take appropriate steps to delete it.
				</p>
			</section>

			<section className="space-y-3">
				<h2>11. Changes to This Policy</h2>
				<p>
					We may update this policy from time to time. Material changes will be posted on this page with an updated &quot;Last
					Updated&quot; date. Continued use of the Service after changes become effective means you accept the revised policy.
				</p>
			</section>

			<section className="space-y-3">
				<h2>12. Contact</h2>
				<p>
					For privacy-related questions: <span aria-hidden>📧</span>{" "}
					<a href="mailto:shahmeet8210@gmail.com" className="text-indigo-400 underline-offset-2 hover:underline">
						shahmeet8210@gmail.com
					</a>
				</p>
				<p className="pt-2">
					See also our <Link to="/terms">Terms of Service</Link> and <Link to="/legal/cookies">Cookie Policy</Link>.
				</p>
			</section>
		</LegalDocumentShell>
	);
}
