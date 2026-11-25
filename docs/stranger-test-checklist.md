# Stranger test: sign-up and payment, step by step

Goal: go through Land Oracle exactly like a brand-new customer would, on the live site, and write down everything odd. This is the one check nobody has done from outside: our scripted tests use a stand-in login and a test database.

**Use a regular email you do not use for admin** (not `dpepperd@gmail.com`, not Tatjana's). A plus address works if your email supports it (for example `yourname+test1@gmail.com`). Use a private/incognito window so you are not signed in to anything. Keep your phone nearby: do part B on it too.

Write down for every step: what you expected, what happened, and the time. Take a screenshot of anything strange.

## A. Before you pay (about 15 minutes)

1. Open https://landoracle.ai signed out. The page loads, nothing looks broken, no console red flags you can see.
2. Click **Pricing**. Check the three plans and the prices match what you intend to charge: Scout $79 a month, Pro $199, Statewide $449, county add-on $39. Toggle monthly and annual. Check the discount banner (FOUNDING40) shows or does not show correctly.
3. Click **Get Scout** (or Get Pro / Get Statewide) while signed out. You should land on a sign-up page, not a dead end.
4. Sign up with the new email. Confirm the email code arrives and works. Note how long it took.
5. After sign-up, where do you land? It should be clear what to do next. Note if you land on an "access denied" page or a blank page.
6. Try the **Territories** page signed in. Pick counties if it asks. Check you cannot pick more than the plan allows.
7. Open the **dashboard** and run: a county search, a drawn area search, an acreage filter (then turn it off), absentee owner, a parcel ID search, an address search. Open a parcel popup and the county appraiser link.
8. Try **Export CSV** on a free account. It should tell you politely that it is not included, not error.
9. Open the **AI Analyst** on a free account. It should say it is not included or coming soon, not hang.
10. Open the dashboard **Settings** page and the **Support** page.

## B. Repeat the key steps on your phone (about 10 minutes)

11. Sign in on your phone with the same test account. Run one search. Note whether the filters, the map and the list are usable on a small screen.

## C. Pay (about 10 minutes)

12. From the pricing page choose **Scout, monthly**. Enter the code **FOUNDING40** if you want to test the discount (it only works for the first 20 uses: do not waste one unless you want to; the price with it should be about $47.40 a month for Scout).
13. Pay with a **real card**. This is a live-mode test, so it will charge real money. Note the exact amount on the Stripe page and compare it with the plan price.
14. After paying you should return to the dashboard with a success message. Note how long it took for your plan to show as paid.
15. Check the plan limits now apply: you can pick the right number of counties, and **Export CSV** works.
16. Open the **Support** page and click **Manage Subscription** (it opens Stripe's customer portal). Check it opens and shows the subscription.
17. Check you got a **receipt email** from Stripe.

## D. Change and cancel (about 10 minutes)

18. In that portal, **upgrade** to Pro. Check the charge is sensible (prorated) and that the county allowance and the AI Analyst now appear.
19. **Downgrade** back to Scout. Check what the app says about counties (it should ask you to re-pick if you have too many).
20. **Cancel** the subscription. Check the app shows it ends at the end of the period (not immediately).
21. **Request a refund** by emailing support, at support@landoracle.ai (the address on the refund page). Refunds are only automatic through us: do not use a card dispute. Under the policy you qualify if you paid less than 7 days ago, exported fewer than 500 rows and asked fewer than 25 AI questions.

## E. Tell me afterwards

Send these back, in one message:
- Anything that errored, hung, looked wrong, or confused you (with screenshots).
- How long sign-up and checkout took.
- The exact amounts charged and refunded.
- Whether the confirmation, receipt and any other emails arrived and read sensibly.

## After the test (owner, same day)

- Refund the payment in the Stripe dashboard if support has not already.
- Make sure the subscription is cancelled in Stripe.
- Delete the test user from the Clerk dashboard if you want it gone. Deleting the user also removes its notes, leads and county picks (that cleanup runs automatically).
- Do not use a card dispute.

## Not covered here (separately)

- Failed payment: use Stripe's test card `4000 0000 0000 0341` in **test mode only**, never in live mode.
- The admin account: sign in as admin separately and check the admin panel loads. Tatjana's account was fixed by hand on Nov 25, so have her sign in once and confirm she sees admin features.
