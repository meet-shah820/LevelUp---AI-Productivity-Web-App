import { Link } from "react-router-dom";
import { LegalDocumentShell } from "../../components/legal/LegalDocumentShell";

export default function CookiePolicy() {
	return (
		<LegalDocumentShell title="Cookie Policy" metaLine="Last Updated: June 23, 2026">
			<section className="space-y-3">
				<h2>1. What are cookies?</h2>
				<p>
					Cookies are small text files stored on your device when you visit a website. We also use similar technologies such as{" "}
					<strong className="text-gray-200">local storage</strong> and <strong className="text-gray-200">session storage</strong>{" "}
					in your browser. In this policy, &quot;cookies&quot; refers to cookies and these similar technologies unless we say
					otherwise.
				</p>
			</section>

			<section className="space-y-3">
				<h2>2. How LevelUp uses cookies &amp; storage</h2>
				<p>We group the technologies we use into the following categories:</p>

				<h3 className="text-gray-200 text-sm font-medium pt-1">Strictly necessary</h3>
				<p>These are required for the Service to function. Without them, you may not be able to sign in or use core features.</p>
				<ul>
					<li>
						<strong className="text-gray-200">Authentication:</strong> a token stored in local storage (for example{" "}
						<code className="text-indigo-300">auth_token</code>) so you remain signed in between visits.
					</li>
					<li>
						<strong className="text-gray-200">Security &amp; routing:</strong> values such as a post-login return path or
						pending referral code needed to complete sign-up or invite flows.
					</li>
					<li>
						<strong className="text-gray-200">Hosting:</strong> cookies that may be set by our hosting or CDN provider to
						deliver the site securely and reliably.
					</li>
				</ul>

				<h3 className="text-gray-200 text-sm font-medium pt-1">Functional</h3>
				<p>These remember choices you make so the app works the way you expect:</p>
				<ul>
					<li>Onboarding or tutorial progress</li>
					<li>Notification read-state or UI preferences you set in the app</li>
					<li>Display name or username hints stored locally for convenience after sign-in</li>
				</ul>

				<h3 className="text-gray-200 text-sm font-medium pt-1">Analytics</h3>
				<p>
					When our production analytics configuration is active, we use <strong className="text-gray-200">PostHog</strong> to
					measure how LevelUp is used so we can improve the product. PostHog may set first-party cookies and store identifiers
					in your browser. This can include:
				</p>
				<ul>
					<li>Anonymous or signed-in visitor identifiers</li>
					<li>Session information for page views, feature usage, and product events</li>
					<li>Session replay data (recordings of in-app interactions, with form inputs masked by default)</li>
				</ul>
				<p>
					We do <strong className="text-gray-200">not</strong> use Google Analytics. PostHog&apos;s privacy practices are
					described in their{" "}
					<a
						href="https://posthog.com/privacy"
						target="_blank"
						rel="noopener noreferrer"
						className="text-indigo-400 underline-offset-2 hover:underline"
					>
						Privacy Policy
					</a>
					.
				</p>
			</section>

			<section className="space-y-3">
				<h2>3. Third-party cookies</h2>
				<p>Other companies may set cookies when you use parts of LevelUp that involve their services:</p>
				<ul>
					<li>
						<strong className="text-gray-200">Stripe</strong> — when you open Stripe Checkout or the Customer Portal for
						subscriptions (
						<a
							href="https://stripe.com/privacy"
							target="_blank"
							rel="noopener noreferrer"
							className="text-indigo-400 underline-offset-2 hover:underline"
						>
							Stripe Privacy
						</a>
						)
					</li>
					<li>
						<strong className="text-gray-200">Google</strong> — when you authenticate with Google (
						<a
							href="https://policies.google.com/technologies/cookies"
							target="_blank"
							rel="noopener noreferrer"
							className="text-indigo-400 underline-offset-2 hover:underline"
						>
							Google Cookies Policy
						</a>
						)
					</li>
					<li>
						<strong className="text-gray-200">PostHog</strong> — when analytics is enabled in production (
						<a
							href="https://posthog.com/privacy"
							target="_blank"
							rel="noopener noreferrer"
							className="text-indigo-400 underline-offset-2 hover:underline"
						>
							PostHog Privacy
						</a>
						)
					</li>
				</ul>
				<p>We do not control third-party cookies. Please review the relevant provider&apos;s policies for more information.</p>
			</section>

			<section className="space-y-3">
				<h2>4. Legal basis (where applicable)</h2>
				<p>
					Where privacy laws such as the GDPR or UK GDPR apply, we rely on <strong className="text-gray-200">contract</strong>{" "}
					and <strong className="text-gray-200">legitimate interests</strong> to use strictly necessary and functional storage,
					and on <strong className="text-gray-200">legitimate interests</strong> (improving and securing the Service) for
					analytics unless your jurisdiction requires consent for non-essential cookies. If you are in a region that requires
					consent for analytics cookies and you do not wish to be tracked, use the choices described below or contact us.
				</p>
			</section>

			<section className="space-y-3">
				<h2>5. Managing cookies &amp; storage</h2>
				<p>You can control cookies and browser storage in several ways:</p>
				<ul>
					<li>
						<strong className="text-gray-200">In-app banner:</strong> on your first visit, LevelUp asks you to accept
						analytics or continue with essential cookies only.
					</li>
					<li>
						<strong className="text-gray-200">Settings:</strong> signed-in users can change cookie preferences under{" "}
						<strong className="text-gray-200">Settings → Legal &amp; policies → Cookie preferences</strong>.
					</li>
					<li>
						<strong className="text-gray-200">Browser settings:</strong> most browsers let you block, delete, or limit
						cookies and site data. Blocking strictly necessary storage may prevent sign-in or break core features.
					</li>
					<li>
						<strong className="text-gray-200">Sign out:</strong> signing out removes the need for an active auth token in
						your browser, though other stored preferences may remain until you clear them.
					</li>
					<li>
						<strong className="text-gray-200">Contact us:</strong> you may email us to request help opting out of analytics
						associated with your account where technically feasible.
					</li>
				</ul>
			</section>

			<section className="space-y-3">
				<h2>6. Changes to this policy</h2>
				<p>
					We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated &quot;Last
					Updated&quot; date.
				</p>
			</section>

			<section className="space-y-3">
				<h2>7. Contact</h2>
				<p>
					Questions about cookies or tracking can be sent to{" "}
					<a href="mailto:shahmeet8210@gmail.com" className="text-indigo-400 underline-offset-2 hover:underline">
						shahmeet8210@gmail.com
					</a>
					. See also our <Link to="/privacy">Privacy Policy</Link> and <Link to="/terms">Terms of Service</Link>.
				</p>
			</section>
		</LegalDocumentShell>
	);
}
