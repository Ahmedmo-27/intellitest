# Ana — Live Demo Presentation Guide (Debuggo)

I've read your `AI_CONTEXT.md`, looked at the architecture diagrams, and skimmed the extension manifest to make sure my advice matches what Debuggo actually does today. Here is a tight, David‑Malan‑flavored playbook you can adapt.

---

## 1. Mindset before you walk on

You're picking up right after Norhan has framed: *"We are not ChatGPT, we are not Cursor."* Your single job in 4–5 minutes is to **prove that claim on screen**. Everything else (architecture, flow) is Michael's and Mostafa's job — you only **drop bread crumbs** they will pick up.

Three David Malan moves to borrow:

- **Open with a question, not a sentence.** Pause for 2 seconds. Look at the audience, not the laptop.
- **Narrate what's happening on the screen out loud**, slowly, like you're explaining magic. He always says "watch what happens when I…"
- **Reveal, don't list.** Don't say "now I will show feature 1, feature 2…". Let each click be a small surprise.

---

## 2. The 4–5 minute demo storyboard

Think of it as 6 beats. Don't memorize lines — internalize the **beat** and the **point of each beat**.

### Beat 0 — Hook (≈ 25 sec)

**On screen:** VS Code already open, Debuggo sidebar closed, a small/medium real‑looking project loaded (Node/Express backend is perfect — relatable).

**What to say (your own words, not a script):**
> "Quick question — raise your hand if you actually enjoy writing test cases."
> *(pause, smile, count the hands or lack of)*
> "Right. Nobody. And that's exactly the problem. Testing is the part of software engineering everyone agrees matters, and nobody wants to do. So — Norhan told you what we built. Let me **show** you why it's different."

That last sentence is your bridge from Norhan.

### Beat 1 — "It's a real product, not a demo" (≈ 20 sec)

**On screen:** Open the VS Code Extensions marketplace, search **Debuggo**, hover over the *Install* button (it's already installed but show the listing).

**Say:**
> "First — this isn't a localhost prototype. Debuggo is live on the VS Code marketplace. Anyone in this room can install it in 10 seconds, today."

*Bread‑crumb for later:* "live on the marketplace" hints at the deployed backend without explaining it.

### Beat 2 — "It already knows your project" (≈ 35 sec)

**On screen:** Click the Debuggo icon in the activity bar → sidebar opens → tech stack chips appear → expand one or two **Code Insights** rows.

**Say (slowly, this is the wow):**
> "Notice I haven't typed a single thing yet. Debuggo already knows this is a Node + Express project. And look here — it has read every function, every class, every parameter in my workspace. *(expand a file)* This is not ChatGPT. ChatGPT has no idea what's in your project unless you paste it. Cursor needs you to chat. Debuggo just **knows**."

**Testing‑lingo bread‑crumb (one sentence):**
> "In testing we call this *context awareness* — your tests are only as good as how well the tool understands what it's testing."

### Beat 3 — The magic moment: prompt → test cases (≈ 75 sec)

**On screen:** Click one of the example **"Try…" chips** OR type a short prompt like:
> *"Generate test cases for the login route in `authController.js`"*

Hit generate. While it spins:

> "Watch what happens. I'm asking it in plain English — like I would ask a teammate. And because it already has the AST symbols of `authController.js`, it doesn't hallucinate parameters that don't exist."

When the table renders, **scroll through one card slowly** and read aloud the fields:
> "Test Case ID, Title, Preconditions, Steps, Expected Result, Priority. This is the **IEEE‑style format** every QA engineer recognizes — what you'd hand to a manager on day one of a job."

Then drop the **methodology hook** (1 sentence each, no lectures):
> "And it's not just happy paths. Notice this one — it tests an empty password. That's a *negative test case*. This one tests a 51‑character username — that's *boundary value analysis*. These are the techniques juniors take months to learn; Debuggo applies them by default."

That's three textbook testing methodologies (positive/negative testing, boundary value analysis, structured test case format) dropped in under 20 seconds — enough to sound credible without lecturing.

### Beat 4 — Generated code + export (≈ 50 sec)

**On screen:** Scroll to the **Generated Code** panel below the test cases. Show the actual runnable test script (e.g., Jest/Mocha). Hover over the **Save** / **Copy** button.

> "And here is the part nobody else does. These aren't just **descriptions** of tests — Debuggo writes the **actual code**, in the framework it recommended for your stack, ready to drop into your repo."

Then click **Export to Excel**, open the file briefly:

> "Or — because most QA teams still live in Excel — one click and your whole test plan is a spreadsheet you can hand to your manager."

**Bread‑crumb for Mostafa's flow slide:** "framework it recommended for your stack" — hints that Debuggo *decided*, not just generated.

### Beat 5 — Optional account + close (≈ 30 sec)

**On screen:** Click **Sign in** in the header, show the panel, close it again.

> "One last thing — you don't *have to* sign in to use it. But if you do, your test cases, your project context, your chat history — all of it persists. Open VS Code on a different machine tomorrow, your work is there."

**Hand off to Michael:**
> "So that's what it does. Now you're probably wondering **how** any of that is possible — how does it know my project, how does it write the code, where does the AI actually live. Michael's going to walk you through that. Michael, over to you."

That last line is gold — it teases Michael's architecture talk perfectly and makes the transition feel inevitable, not awkward.

---

## 3. Feature checklist (so you don't forget any)

Tick these off mentally as you go — every one of these is in the codebase and Norhan/Michael/Mostafa will reference some of them:

- [ ] Installed from VS Code Marketplace (deployed, not local)
- [ ] Sidebar UI inside VS Code
- [ ] Automatic tech‑stack detection
- [ ] Code Insights (AST symbols per file)
- [ ] Prompt input (use an example chip if you can — shows polish)
- [ ] Structured test cases (ID, Title, Description, Preconditions, Steps, Expected, Priority)
- [ ] Recommended testing framework
- [ ] Generated test **code** (not just descriptions)
- [ ] Save code to file / copy to clipboard
- [ ] Excel export
- [ ] Optional sign‑in (guest‑first, per‑user history)

If you're running short on time, the two you can drop are **sign‑in** and **clipboard save** — everything else is core.

---

## 4. Testing terms you can sprinkle (and what they mean, in case you're asked)

Don't dump these — use **at most 3** during your 4 minutes. Just enough to sound like you know what you're talking about.

- **Test case** — a single scenario: given X, do Y, expect Z.
- **Positive vs negative testing** — does the feature work when used correctly (positive), and does it fail gracefully when abused (negative, e.g. empty fields, wrong types).
- **Boundary value analysis** — testing the edges of allowed input (e.g., max length, zero, negative numbers). Bugs hide at the edges.
- **Equivalence partitioning** — grouping inputs that behave the same so you don't test 1,000 variations of the same thing.
- **Edge case** — an unusual but valid input (e.g., user with emoji in their name).
- **Test plan / test suite** — the full collection of test cases for a feature or product.
- **IEEE 829 format** — the industry‑standard structure for documenting test cases (the same fields Debuggo outputs). Saying "IEEE‑style" once = instant credibility.
- **Shift‑left testing** — writing tests early in development instead of at the end. Debuggo is literally shift‑left because it generates tests inside the IDE while you code.

If you want **one quotable line**, try this one — it lands well:

> "Debuggo is *shift‑left testing in one click* — tests where the code is written, not at the end of the sprint when nobody has time."

---

## 5. Things to avoid (David Malan trap‑doors)

- **Don't read the screen aloud word‑for‑word.** Narrate the *meaning*, not the text.
- **Don't fill silence while it generates.** A 3‑second pause while you smile at the audience is more powerful than nervous talking. Malan does this constantly.
- **Don't apologize.** If something's slow, say *"this is talking to our hosted backend right now — you'll see why that matters in a moment."* Turn it into a feature.
- **Don't say "as you can see"** — it's filler. Say *"notice"* or *"watch this"* instead.
- **Don't oversell.** One "magic" is fine, two is too many.

---

## 6. Likely Q&A (and short, confident answers)

I'd prepare for these. Keep answers **2 sentences max** in the live setting — depth only if asked again.

**Q1. How is this different from ChatGPT / Copilot / Cursor?**
> "ChatGPT doesn't see your project — you have to paste code into it. Cursor is a general assistant, not a tester. Debuggo is purpose‑built for test design: it reads your AST, applies real testing methodologies like boundary analysis, and outputs in QA‑standard format ready for Excel."

**Q2. Doesn't it just send all my code to an AI?**
> "No, and that's deliberate. We parse the code into an AST locally and only send **structural symbols** — function names, parameters, types — not raw source. It's lighter, faster, and safer."
*(This is straight from `AI_CONTEXT.md` — true and impressive.)*

**Q3. Which AI model are you using?**
> "Currently Groq, because it's fast and free‑tier friendly. Our architecture is provider‑agnostic — we plan to move to Qwen for test cases and DeepSeek for code generation once we have the credits. That's covered in our future plans."
*(This sets up Ana's own constraints slide perfectly.)*

**Q4. Does it actually run the tests?**
> "Not yet — generation today, execution next. That's literally the first item on our future plans slide."

**Q5. What languages / frameworks does it support?**
> "Right now JS/TS deeply because that's what we parse with the AST. The output frameworks — Jest, Mocha, Supertest, etc. — are picked dynamically per project. Adding Python/Java is straightforward; the architecture is language‑pluggable."

**Q6. What happens if the AI gets a test case wrong?**
> "Two safeguards. First, a **verification layer** checks the AI's output against the actual project — if it references a function that doesn't exist, we reject it. Second, the output is structured JSON validated against a schema. Hallucinations get filtered, not displayed."
*(Bread‑crumb to Mostafa's flow.)*

**Q7. Who is this for?**
> "Junior testers and developers who don't yet have the muscle memory for test design — and senior engineers who do, but don't want to spend 3 hours writing boilerplate test plans."

**Q8. Is it free?**
> "Today, yes — install from the marketplace and use it. Long‑term, we'll likely have a free tier and a paid tier when we move to premium models."

**Q9. Can I use it offline?**
> "No — it depends on a hosted backend that talks to the AI provider. That's a deliberate choice: it keeps the extension lightweight and lets us swap models without users updating anything."

**Q10. How do you handle privacy / NDAs / private code?**
> "We never send raw source code — only AST symbols, as mentioned. For enterprise customers, a self‑hosted backend is a natural next step."

**Q11. Why VS Code only? What about JetBrains / IntelliJ?**
> "VS Code first because it has the largest developer reach and the cleanest extension API. Cursor, Windsurf, and Antigravity are next — they're all VS Code forks so the lift is small. JetBrains is a longer‑term port."
*(Bread‑crumb to your team's future plans.)*

**Q12. Why not just write a prompt template in ChatGPT that does the same thing?**
> "Because a prompt can't read your AST, can't validate the AI's output, can't enforce IEEE format, can't export to Excel, and can't persist your project context across sessions. Debuggo is the prompt plus the **plumbing** that makes the prompt actually trustworthy."

---

## 7. One last tip — the practice loop

Before the day:
1. Run the demo **end‑to‑end three times in a row** without stopping. The third time is where it gets natural.
2. **Time yourself.** If you're over 5 min, cut the sign‑in beat first.
3. Record yourself once on your phone. Watch it. You'll instantly see filler words to drop.

You've got a strong product and a clean structure. The 4 minutes will fly if you let each click breathe.

Good luck — break a leg.
