from pathlib import Path

readme = Path("README.md")
s = readme.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global s
    if old not in s:
        raise SystemExit(f"Missing README block: {label}")
    s = s.replace(old, new, 1)


replace_once(
    '''<p align="center">\n  <a href="#why-retza-exists">Why</a> ·\n  <a href="#how-show-me-works">Show Me</a> ·\n  <a href="#architecture-and-trust-boundaries">Architecture</a> ·\n  <a href="#testing-changed-the-product">Iteration</a> ·\n  <a href="#testing-and-verification">Verification</a> ·\n  <a href="#run-locally">Run locally</a>\n</p>''',
    '''<p align="center">\n  <a href="#show-me-in-action">Demo</a> ·\n  <a href="#my-contribution">My contribution</a> ·\n  <a href="#why-retza-exists">Problem</a> ·\n  <a href="#how-show-me-works">Engineering</a> ·\n  <a href="#testing-changed-the-product">Iteration</a> ·\n  <a href="#testing-and-verification">Verification</a> ·\n  <a href="#run-locally">Run locally</a>\n</p>''',
    "navigation",
)

replace_once(
    '''<p align="center">\n  <img src="docs/assets/retza-product-flow.svg" alt="Retza product flow from asking a computer question to a walkthrough and verified Show Me highlight" width="100%">\n</p>''',
    '''<p align="center">\n  <img src="docs/assets/retza-walkthrough.webp" alt="Retza desktop application showing a YouTube Studio walkthrough with simple numbered steps and a Start Walkthrough action" width="100%">\n</p>''',
    "hero visual",
)

replace_once(
    "A Windows-first desktop accessibility assistant that turns computer questions into plain-language walkthroughs and verified on-screen guidance.",
    "A Windows-first desktop accessibility assistant that turns computer questions into plain-language walkthroughs, proactive support, and verified on-screen guidance.",
    "opening description",
)

replace_once(
    "Retza began with a simple question: **what if computer help was designed for people who do not already understand computers?** The first prototype focused on making AI instructions shorter and easier to read. User testing exposed a deeper problem. A person could understand the instruction and still be unable to find the button it described.",
    "Retza began with a simple question: **what if computer help was designed for people who do not already understand computers?** Early versions focused on shorter AI instructions and a deliberately simple interface. User testing exposed a deeper problem. A person could understand an instruction and still be unable to find the button or icon it described.",
    "opening project story",
)

replace_once(
    "| **User-centered iteration** | Testing showed that understandable instructions still fail when users cannot locate the control, which drove the visual-guidance direction |\n| **Verification** | Windows CI runs type checking, 103 automated Vitest tests across six test files, and a production build |",
    "| **User-centered iteration** | Testing showed that understandable instructions still fail when users cannot locate the relevant control |\n| **My contribution** | Target-user research, problem framing, use-case selection, direct user testing, feedback interpretation, product direction, and project communication |\n| **Team** | Four people: Michael Tetelbaum, Vladimir Dukkardt, Algasem Zabarah, and Kevin Zhu |\n| **Verification** | Windows CI runs type checking, 103 automated Vitest tests across six test files, and a production build |",
    "at-a-glance table",
)

show_me = '''\n## Show Me in action\n\n<p align="center">\n  <img src="docs/assets/retza-show-me.gif" alt="Animated Retza demo showing the Show Me feature locating and visually highlighting the next interface control" width="520">\n</p>\n\nThe animation above captures the feature that most clearly represents the project's evolution. Retza does not merely tell the user what to click. A walkthrough step can expose **Show Me**, which resolves the intended control through Windows UI Automation, validates the match, converts its screen geometry, and presents a visual guide only when the evidence is strong enough.\n\nThis matters because the most important usability failure we observed was not misunderstanding the words. It was understanding the words and still not knowing where to act.\n'''
replace_once("\n## What Retza does\n", show_me + "\n## What Retza does\n", "Show Me section")

contribution = '''\n<p align="center">\n  <img src="docs/assets/retza-product-flow.svg" alt="Retza product flow from asking a computer question to a walkthrough and verified Show Me highlight" width="100%">\n</p>\n\n## My contribution\n\nRetza is a collaborative four-person project, so I do not present the migrated repository history as proof that I personally authored every technical subsystem. My strongest verified contribution was at the intersection of **user research, product thinking, testing, and iteration**.\n\nI focused on understanding the target audience and the kinds of computer tasks that older or less experienced users commonly struggle with. That research shaped the example questions, use cases, and testing scenarios we built around. I also tested Retza directly with my grandmother and watched how she interacted with the instructions rather than relying only on whether she said they were clear.\n\nThat testing exposed the project's most important insight: **a user can understand an instruction and still be unable to locate the control it refers to.** That gap helped drive the visual-guidance direction that became Show Me. I also contributed to interpreting feedback, refining the product's accessibility framing, and communicating why the problem mattered.\n\nThe current system shown in this repository is team-built. Michael Tetelbaum and Algasem Zabarah focused more heavily on AI logic and response generation, Vladimir Dukkardt led much of the interface design and product look and feel, and my work centered on target-user understanding, use cases, testing, and product framing. Prompt refinement and broader iteration were collaborative.\n'''
replace_once("\n## Why Retza exists\n", contribution + "\n## Why Retza exists\n", "contribution section")

replace_once(
    'Our original goal was "zero barrier accessibility." We repeatedly refined the assistant because simply telling an AI to "be simple" still produced jargon, skipped steps, or instructions that made sense only to experienced users. The harder design question became: **what background knowledge is this instruction assuming?**',
    'Our original goal was "zero barrier accessibility." Early prompting experiments showed that simply asking an AI to "be simple" was not enough. Responses could still use jargon such as "settings menu" or "drag and drop," combine multiple actions into one step, or remove so much detail that the instructions stopped being useful. The challenge therefore became more precise: **what background knowledge is this instruction assuming, and how can the product remove that assumption without making the task less accurate?**',
    "prompting insight",
)

replace_once(
    "Testing with older and younger family members revealed the most important failure mode. People could follow the words but still search the screen for the control. That led to the visual-guidance concept and eventually to the current verified **Show Me** pipeline.",
    "Testing included my grandmother and younger users in a teammate's family. We paid attention to hesitation, repeated searching, and places where the person could repeat the instruction correctly but still could not act on it. That observation led to the visual-guidance concept and eventually to the current verified **Show Me** pipeline.",
    "testing detail",
)

s = s.replace(
    "We described this process as **iterative empathy**: watch what users actually do, find the assumptions hidden inside the interface, and change the system around the failure rather than blaming the user.",
    "We described this process as **iterative empathy**: watch what users actually do, find the assumptions hidden inside the interface, and change the system around the failure.",
    1,
)
s = s.replace(
    "**simpler text -> step-by-step walkthroughs -> visual guidance -> evidence-backed UI targeting**",
    "**simpler text -> one-step walkthroughs -> visual guidance -> evidence-backed UI targeting**",
    1,
)
s = s.replace(
    "It also changed how we thought about debugging. Some of the hardest failures were not cases where the software crashed. They were cases where the software behaved as intended but the user still could not confidently complete the task.",
    "The important lesson was that a software failure does not always look like a crash. Retza could behave exactly as programmed and still fail the user if the person could not confidently complete the next action.",
    1,
)
s = s.replace(
    "This README therefore focuses on the finished team-built system, the decisions behind it, and the way user testing changed the product.",
    "For individual contribution, see [My contribution](#my-contribution). That section intentionally separates my verified work from the broader team-built technical system.",
    1,
)

if "—" in s or "–" in s:
    raise SystemExit("README still contains a long dash")
readme.write_text(s, encoding="utf-8")

ui = Path("src/renderer/src/components/MainWindow.tsx")
t = ui.read_text(encoding="utf-8")
for old, new in {
    "Here's the plan — {totalSteps} step{totalSteps !== 1 ? 's' : ''}:": "Here's the plan: {totalSteps} step{totalSteps !== 1 ? 's' : ''}:",
    "Hello! I'm Fox, your friendly computer helper. I'm here whenever you need a hand — just type your question below!": "Hello! I'm Fox, your friendly computer helper. I'm here whenever you need a hand. Just type your question below!",
    "Looks like you might be stuck — need some help? Just type or ask me anything!": "Looks like you might be stuck. Need some help? Just type or ask me anything!",
    "I can't connect yet — please add your Gemini API key in Settings (the gear button).": "I can't connect yet. Please add your Gemini API key in Settings (the gear button).",
    "Something interrupted that request. You're not stuck — please try it again.": "Something interrupted that request. You're not stuck, please try it again.",
    "Watching for help opportunities — click to pause": "Watching for help opportunities, click to pause",
    "Paused — click to resume watching": "Paused, click to resume watching",
}.items():
    t = t.replace(old, new)
ui.write_text(t, encoding="utf-8")
