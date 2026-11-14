
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FolderOpen,
  Landmark,
  LockKeyhole,
  Menu,
  Mic,
  PlayCircle,
  Scale,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
  X,
} from "lucide-react";

import "./Home.css";

const site = {
  name: "AdvocaNote",
  login: "/login",
  register: "/register",
  monthly: "1,490",
  yearly: "14,900",
  saving: "2,980",
  contactEmail: "",
};

const navItems = [
  { label: "Home", id: "home" },
  { label: "Features", id: "features" },
  { label: "How It Works", id: "how-it-works" },
  { label: "Pricing", id: "pricing" },
  { label: "FAQ", id: "faq" },
];

const benefits = [
  {
    Icon: ShieldCheck,
    heading: "Designed for privacy",
    sub: "Your legal work matters",
  },
  {
    Icon: Scale,
    heading: "Made for Sri Lanka",
    sub: "Local legal workflows",
  },
];

const features = [
  {
    Icon: BookOpen,
    title: "Smart Legal Diary",
    text: "Add and manage case details, court notes, and important next dates.",
  },
  {
    Icon: Mic,
    title: "Voice to Text",
    text: "Speak your notes and turn them into written diary entries.",
  },
  {
    Icon: ScanLine,
    title: "AI Diary Scan",
    text: "Convert photos of handwritten diary notes into suggested entries for review.",
    soon: true,
  },
  {
    Icon: CalendarDays,
    title: "Hearings & Calendar",
    text: "See upcoming hearing dates in one organised calendar.",
  },
  {
    Icon: ClipboardCheck,
    title: "Tasks & Deadlines",
    text: "Create follow-up tasks and keep track of important deadlines.",
  },
  {
    Icon: FolderOpen,
    title: "Case Management",
    text: "Keep case information, diary entries and related notes together.",
  },
];

const steps = [
  {
    Icon: UserRoundPlus,
    title: "Create Your Account",
    text: "Register and set up your lawyer profile.",
  },
  {
    Icon: Mic,
    title: "Capture Your Notes",
    text: "Add notes by typing or using Voice to Text.",
  },
  {
    Icon: CalendarDays,
    title: "Manage & Track",
    text: "Organise cases, hearings, tasks and deadlines.",
  },
  {
    Icon: Sparkles,
    title: "Stay in Control",
    text: "Review your work and plan what comes next.",
  },
];

const plans = [
  {
    id: "trial",
    name: "Free Trial",
    note: "Explore AdvocaNote for one month",
    price: "0",
    unit: "for first month",
    points: [
      "Try the core legal diary",
      "Manage cases and hearings",
      "Explore tasks and reminders",
      "Try available Voice to Text tools",
    ],
    action: "Get Started Free",
  },
  {
    id: "monthly",
    name: "Monthly Plan",
    note: "Flexibility for your everyday practice",
    price: site.monthly,
    unit: "/ month",
    points: [
      "Legal diary and case records",
      "Hearings, calendar and reminders",
      "Tasks and deadlines",
      "Available Voice to Text features",
    ],
    action: "Choose Monthly",
    featured: true,
  },
  {
    id: "annual",
    name: "Annual Plan",
    note: "Great value for long-term use",
    price: site.yearly,
    unit: "/ year",
    points: [
      "Monthly plan features included",
      "One yearly subscription",
      `Save LKR ${site.saving} vs monthly`,
      "Ongoing product improvements",
    ],
    action: "Choose Annual",
  },
];

const faqs = [
  {
    q: "Is AdvocaNote designed for Sri Lankan lawyers?",
    a: "Yes. AdvocaNote is designed around Sri Lankan lawyers' everyday diary, case, hearing and task workflows.",
  },
  {
    q: "Can I continue using my paper diary?",
    a: "Yes. AdvocaNote is designed to support your existing paper-diary workflow, not force you to replace it.",
  },
  {
    q: "Can I use Voice to Text for diary notes?",
    a: "AdvocaNote includes a Voice to Text workflow for turning spoken updates into written notes. Review the text before saving important case information.",
  },
  {
    q: "Will AI Diary Scan be available?",
    a: "AI Diary Scan is a planned feature. It is marked Coming Soon and is not included as an available tool until released.",
  },
  {
    q: "What happens after the one-month free trial?",
    a: "You can choose the monthly plan at LKR 1,490 or the annual plan at LKR 14,900. The final billing and cancellation terms will be presented before payment.",
  },
];

function Logo() {
  return (
    <a
      href="#home"
      className="an-logo"
      aria-label="AdvocaNote, go to homepage"
    >
      <img
        src="/images/landing-page/advocanote-logo-icon.png"
        alt="AdvocaNote logo"
        className="an-logo__image"
      />

      <span className="an-logo__type">
        Advoca<span>Note</span>
      </span>
    </a>
  );
}

function Eyebrow({ children, light = false }) {
  return (
    <div
      className={`an-eyebrow${light ? " an-eyebrow--light" : ""}`}
    >
      <span />
      {children}
      <span />
    </div>
  );
}

function SectionTitle({
  kicker,
  title,
  description,
  light = false,
}) {
  return (
    <div
      className={`an-heading${light ? " an-heading--light" : ""}`}
    >
      <Eyebrow light={light}>{kicker}</Eyebrow>

      <h2>{title}</h2>

      {description && <p>{description}</p>}
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const registerLink = (plan) =>
    `${site.register}?plan=${encodeURIComponent(plan)}`;

  // Scroll reveal animations
  useEffect(() => {
    const nodes = document.querySelectorAll(".an-reveal");

    if (
      !window.IntersectionObserver ||
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      nodes.forEach((node) =>
        node.classList.add("an-reveal--visible")
      );
      return;
    }

    document.documentElement.classList.add("an-has-js");

    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("an-reveal--visible");
            observer.unobserve(entry.target);
          }
        }),
      {
        threshold: 0.1,
        rootMargin: "0px 0px -24px 0px",
      }
    );

    nodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("an-has-js");
    };
  }, []);

  // Close mobile navigation with Escape
  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onEscape);

    return () =>
      window.removeEventListener("keydown", onEscape);
  }, []);

  return (
    <div className="an-site">

      {/* =================================
          HERO
      ================================= */}

      <section className="an-hero" id="home">

        <div
          className="an-hero__photo"
          aria-hidden="true"
        />

        <div
          className="an-hero__shade"
          aria-hidden="true"
        />

        {/* NAVBAR */}

        <header className="an-header">
          <div className="an-shell an-header__inner">

            <Logo />

            <nav
              id="an-main-nav"
              className={`an-nav${menuOpen ? " an-nav--open" : ""}`}
              aria-label="Main navigation"
            >
              {navItems.map((item) => (
                <a
                  href={`#${item.id}`}
                  onClick={() => setMenuOpen(false)}
                  key={item.id}
                >
                  {item.label}
                </a>
              ))}

              <a
                className="an-nav__mobile-sign"
                href={site.login}
              >
                Sign In
              </a>

              <a
                className="an-nav__mobile-start"
                href={registerLink("trial")}
              >
                Get Started Free
              </a>
            </nav>

            <div className="an-header__actions">
              <a
                href={site.login}
                className="an-button an-button--nav-outline"
              >
                Sign In
              </a>

              <a
                href={registerLink("trial")}
                className="an-button an-button--gold an-button--nav"
              >
                Get Started
              </a>
            </div>

            <button
              type="button"
              className="an-menu-toggle"
              aria-label={
                menuOpen
                  ? "Close navigation"
                  : "Open navigation"
              }
              aria-expanded={menuOpen}
              aria-controls="an-main-nav"
              onClick={() => setMenuOpen((old) => !old)}
            >
              {menuOpen ? (
                <X size={24} />
              ) : (
                <Menu size={24} />
              )}
            </button>

          </div>
        </header>

        {/* HERO CONTENT */}

        <div className="an-shell an-hero__content">

          <div className="an-hero__copy">


            <h1>
              Your Legal Work.
              <br />
              <em className="an-hero-highlight">
                One Organised Place.
              </em>
            </h1>


            <p>
              Simplify your daily legal work with one organised space for case notes, court hearings, diary entries and important tasks — designed for Sri Lankan lawyers.
            </p>

            <div className="an-hero__buttons">

              <a
                href={registerLink("trial")}
                className="an-button an-button--gold an-button--large"
              >
                Get Started Free
                <ArrowRight size={19} />
              </a>

              

            </div>

            {/* HERO BENEFITS */}

            <div className="an-hero__benefits">
              {benefits.map(({ Icon, heading, sub }) => (
                <div
                  className="an-hero__benefit"
                  key={heading}
                >
                  <Icon
                    size={25}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />

                  <span>
                    <strong>{heading}</strong>
                    <small>{sub}</small>
                  </span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* =================================
          VALUE / TRUST STRIP
      ================================= */}

      <div className="an-trust-wrap">
        <div className="an-shell">

          <div
            className="an-trust"
            aria-label="Why AdvocaNote"
          >

            <div className="an-trust__intro">
              <Scale size={29} />
              <strong>
                Built for Your
                <br />
                Legal Practice
              </strong>
            </div>

            <div className="an-trust__point">
              <Landmark size={25} />
              <span>
                <strong>Sri Lankan</strong>
                <small>Lawyer workflows</small>
              </span>
            </div>

            <div className="an-trust__point">
              <CalendarDays size={25} />
              <span>
                <strong>One Place</strong>
                <small>Cases and hearings</small>
              </span>
            </div>

            <div className="an-trust__point">
              <ClipboardCheck size={25} />
              <span>
                <strong>Stay on Track</strong>
                <small>Tasks and deadlines</small>
              </span>
            </div>

            <div className="an-trust__point">
              <LockKeyhole size={25} />
              <span>
                <strong>Privacy-Minded</strong>
                <small>Thoughtful design</small>
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* =================================
          FEATURES
      ================================= */}

      <section className="an-features" id="features">

        <img
          className="an-features__court"
          src="/images/landing-page/advocanote-courthouse-watermark.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
        />

        <div className="an-shell">

          <SectionTitle
            kicker="POWERFUL FEATURES FOR MODERN LEGAL PRACTICE"
            title="All Your Legal Work, in One Place"
            description="A simpler way to manage cases, hearings, notes and daily legal tasks."
          />

          <div className="an-features__grid">

            {features.map(
              ({ Icon, title, text, soon }, index) => (
                <article
                  className="an-feature an-reveal"
                  key={title}
                  style={{
                    "--an-reveal-delay":
                      `${(index % 3) * 85}ms`,
                  }}
                >

                  <span className="an-feature__icon">
                    <Icon
                      size={27}
                      strokeWidth={1.85}
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <h3>
                      {title}

                      {soon && (
                        <span className="an-soon">
                          Coming Soon
                        </span>
                      )}
                    </h3>

                    <p>{text}</p>
                  </div>

                </article>
              )
            )}

          </div>
        </div>
      </section>

      {/* =================================
          HOW IT WORKS
      ================================= */}

      <section
        className="an-work"
        id="how-it-works"
      >

        <div className="an-shell">

          <SectionTitle
            kicker="SIMPLE, EFFICIENT, BUILT FOR LAWYERS"
            title="How AdvocaNote Works"
            description="Get started in a few simple steps and keep your legal practice organised."
          />

          <div className="an-work__steps">

            {steps.map(
              ({ Icon, title, text }, index) => (
                <div
                  className="an-work__step an-reveal"
                  key={title}
                  style={{
                    "--an-reveal-delay":
                      `${index * 95}ms`,
                  }}
                >

                  <div className="an-work__circle">
                    <Icon
                      size={31}
                      strokeWidth={1.8}
                    />
                  </div>

                  <h3>{title}</h3>
                  <p>{text}</p>

                  {index < steps.length - 1 && (
                    <span
                      className="an-work__arrow"
                      aria-hidden="true"
                    >
                      ››
                    </span>
                  )}

                </div>
              )
            )}

          </div>
        </div>
      </section>

      {/* =================================
          PRICING
      ================================= */}

      <section
        className="an-pricing"
        id="pricing"
      >

        <div
          className="an-pricing__photo"
          aria-hidden="true"
        />

        <div className="an-shell an-pricing__content">

          <SectionTitle
            kicker="FLEXIBLE PLANS FOR EVERY LEGAL PRACTICE"
            title="Simple & Transparent Pricing"
            description="Start with one month free, then choose a plan that suits your practice."
            light
          />

          <div className="an-pricing__grid">

            {plans.map((plan) => (
              <article
                className={`an-plan an-reveal${plan.featured
                  ? " an-plan--featured"
                  : ""
                  }`}
                key={plan.id}
              >

                {plan.featured && (
                  <span className="an-plan__label">
                    Most Popular
                  </span>
                )}

                <div className="an-plan__header">
                  <h3>{plan.name}</h3>
                  <p>{plan.note}</p>
                </div>

                <div className="an-plan__price">
                  <small>LKR</small>

                  <strong>{plan.price}</strong>

                  <span>{plan.unit}</span>
                </div>

                <ul>
                  {plan.points.map((point) => (
                    <li key={point}>
                      <Check
                        size={17}
                        aria-hidden="true"
                      />
                      {point}
                    </li>
                  ))}
                </ul>

                <a
                  href={registerLink(plan.id)}
                  className={`an-button an-plan__action${plan.featured
                    ? " an-button--gold"
                    : " an-button--outline-dark"
                    }`}
                >
                  {plan.action}
                  <ArrowRight size={17} />
                </a>

              </article>
            ))}

          </div>

          <p className="an-pricing__disclaimer">
            * AI Diary Scan is coming soon.
            Please confirm final billing terms and enabled
            features before subscribing.
          </p>

        </div>
      </section>

      {/* =================================
          FAQ
      ================================= */}

      <section className="an-faq" id="faq">

        <img
          className="an-faq__court"
          src="/images/landing-page/advocanote-courthouse-watermark.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
        />

        <div className="an-shell an-faq__layout">

          <div className="an-faq__copy">

            <div className="an-faq__eyebrow">
              FREQUENTLY ASKED QUESTIONS
            </div>

            <h2>Have Questions?</h2>

            <p>
              Find quick answers to common questions
              about AdvocaNote.
            </p>

          </div>

          <div className="an-faq__list">

            {faqs.map(({ q, a }, i) => (
              <div
                className={`an-faq__item${openFaq === i
                  ? " an-faq__item--open"
                  : ""
                  }`}
                key={q}
              >

                <button
                  type="button"
                  onClick={() =>
                    setOpenFaq((old) =>
                      old === i ? -1 : i
                    )
                  }
                  aria-expanded={openFaq === i}
                  aria-controls={`an-faq-answer-${i}`}
                >
                  <span>{q}</span>

                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                  />
                </button>

                <div
                  className="an-faq__answer"
                  id={`an-faq-answer-${i}`}
                  hidden={openFaq !== i}
                >
                  <p>{a}</p>
                </div>

              </div>
            ))}

          </div>
        </div>
      </section>

      {/* =================================
          FINAL CTA
      ================================= */}

      <section className="an-cta-section">

        <div className="an-shell">

          <div className="an-cta an-reveal">

            <img
              src="/images/landing-page/advocanote-cta-justice.png"
              alt=""
              aria-hidden="true"
              loading="lazy"
            />

            <div className="an-cta__copy">

              <h2>
                Ready to Simplify Your Legal Practice?
              </h2>

              <p>
                Get started with AdvocaNote and stay
                more organised, one day at a time.
              </p>

            </div>

            <a
              href={registerLink("trial")}
              className="an-button an-button--gold"
            >
              Get Started Free
              <ArrowRight size={18} />
            </a>

          </div>
        </div>
      </section>

      {/* =================================
          FOOTER
      ================================= */}

      <footer
        className="an-footer"
        id="contact"
      >

        <div className="an-shell">

          <div className="an-footer__grid">

            <div className="an-footer__brand">

              <Logo />

              <p>
                A smarter legal diary designed
                for Sri Lankan lawyers.
              </p>

            </div>

            <div className="an-footer__column">
              <h3>Product</h3>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#pricing">Pricing</a>
            </div>

            <div className="an-footer__column">
              <h3>Support</h3>
              <a href="#faq">FAQ</a>

              {site.contactEmail && (
                <a
                  href={`mailto:${site.contactEmail}`}
                >
                  Contact Us
                </a>
              )}

              <a href={site.login}>Sign In</a>
            </div>

            <div className="an-footer__column">
              <h3>AdvocaNote</h3>
              <a href="#home">Home</a>
              <a href={registerLink("trial")}>
                Start Free Trial
              </a>
              <a href="#contact">Contact</a>
            </div>

          </div>

          <div className="an-footer__bottom">
            <span>
              © {new Date().getFullYear()} AdvocaNote.
              All rights reserved.
            </span>

            <span>
              Built for Sri Lankan legal professionals.
            </span>
          </div>

        </div>
      </footer>

    </div>
  );
}
