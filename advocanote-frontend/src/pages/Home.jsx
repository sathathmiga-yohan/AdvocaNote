
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
const bookFeatures = [
  {
    Icon: BookOpen,
    title: "Smart Legal Diary",
    short: "Manage case notes and daily legal work in one place.",
    description:
      "Keep your daily court notes, case details and important next dates organised in one structured legal diary.",
    points: [
      "Add and review daily diary entries",
      "Maintain court notes clearly",
      "Track case-related updates easily",
    ],
  },
  {
    Icon: Mic,
    title: "Voice to Text",
    short: "Turn spoken legal notes into written entries.",
    description:
      "Use voice input to quickly capture legal notes and convert them into diary entries without typing everything manually.",
    points: [
      "Record spoken legal notes",
      "Convert speech into written text",
      "Edit before saving your entry",
    ],
  },
  {
    Icon: ScanLine,
    title: "AI Diary Scan",
    short: "Convert handwritten notes into digital entries.",
    description:
      "A future AI-powered feature that helps convert handwritten diary notes into structured digital records for lawyer review.",
    points: [
      "Scan handwritten diary pages",
      "Generate suggested digital entries",
      "Review before saving to the diary",
    ],
    soon: true,
  },
  {
    Icon: CalendarDays,
    title: "Hearings & Calendar",
    short: "Track upcoming hearings in one organised calendar.",
    description:
      "View hearings, dates and scheduling details in one place so nothing important gets missed.",
    points: [
      "See upcoming hearing dates",
      "Organise events in calendar view",
      "Stay aware of legal schedule",
    ],
  },
  {
    Icon: ClipboardCheck,
    title: "Tasks & Deadlines",
    short: "Create follow-ups and stay on top of deadlines.",
    description:
      "Manage legal tasks, priorities and important deadlines so your daily workflow stays under control.",
    points: [
      "Add tasks and deadlines",
      "Set follow-up reminders",
      "Track progress clearly",
    ],
  },
  {
    Icon: FolderOpen,
    title: "Case Management",
    short: "Keep case information and related notes together.",
    description:
      "Store case details, diary records and related legal information together in one organised workspace.",
    points: [
      "Manage case information centrally",
      "Connect diary entries with cases",
      "Keep related records together",
    ],
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
    a: "Yes. AdvocaNote is designed specifically for Sri Lankan lawyers to manage daily diary entries, court cases, hearings, tasks and deadlines in one organised workspace.",
  },
  {
    q: "Can I continue using my paper diary?",
    a: "Absolutely. AdvocaNote supports your traditional diary workflow. You can continue using your paper diary while keeping important legal records organised digitally.",
  },
  {
    q: "Can I use Voice to Text for diary notes?",
    a: "Yes. You can record your spoken court notes and convert them into written diary entries using Voice to Text. You can review and edit the text before saving.",
  },
  {
    q: "How can I track my upcoming hearings?",
    a: "AdvocaNote helps you organise upcoming hearing dates through the Hearings and Calendar sections, making it easier to plan your legal activities.",
  },
  {
    q: "Will AI Diary Scan be available?",
    a: "AI Diary Scan is a planned feature that will help convert handwritten diary notes into structured digital entries for your review. Coming Soon.",
  },
  {
    q: "What happens after the one-month free trial?",
    a: "After your one-month free trial, you can select Basic at LKR 1,490/month, Premium at LKR 3,290/month, or Annual at LKR 14,900/year.",
  },
];

const faqColumns = [
  faqs.slice(0, 3),
  faqs.slice(3, 6),
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

      <h2>{title}</h2>

      {description && <p>{description}</p>}
    </div>
  );
}

export default function Home() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [showAllFaq, setShowAllFaq] = useState(false);
  const registerLink = (plan) =>
    `${site.register}?plan=${encodeURIComponent(plan)}`;
  const currentFeature = bookFeatures[activeFeature];
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


      {/* ============================================
    ADVOCANOTE PREMIUM BOOK FEATURES
============================================ */}

      <section
        className="an-book-features"
        id="features"
      >
        <div className="an-shell">

          {/* SECTION HEADING */}

          <SectionTitle
            title="Everything You Need in One Place"
            description="From traditional diary workflows to smart legal tools — everything your legal practice needs."
          />

          {/* MAIN THREE COLUMN LAYOUT */}

          <div className="an-bf__layout">

            {/* ==================================
          LEFT SIDE - THREE FEATURES
      ================================== */}

            <div className="an-bf__side an-bf__side--left">

              {[
                {
                  Icon: BookOpen,
                  title: "Smart Legal Diary",
                  text: "Manage daily court notes, case information and next hearing dates.",
                },
                {
                  Icon: CalendarDays,
                  title: "Hearings and Calendar",
                  text: "View upcoming hearings and organise important dates.",
                },
                {
                  Icon: FolderOpen,
                  title: "Case Management",
                  text: "Keep cases, diary entries and related records together.",
                },
              ].map(({ Icon, title, text }, index) => (

                <div
                  className="an-bf__feature"
                  key={title}
                  style={{
                    "--feature-delay": `${index * 120}ms`,
                  }}
                >

                  <div className="an-bf__icon">
                    <Icon
                      size={30}
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="an-bf__copy">
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>

                  <span
                    className="an-bf__connector"
                    aria-hidden="true"
                  />

                </div>

              ))}

            </div>

            {/* ==================================
          CENTRE - REAL ADVOCANOTE BOOK
      ================================== */}

            <div className="an-bf__centre">

              {/* GOLD CIRCULAR BACKGROUND */}

              <div
                className="an-bf__halo"
                aria-hidden="true"
              />

              <div
                className="an-bf__halo-inner"
                aria-hidden="true"
              />

              {/* ACTUAL BOOK PNG IMAGE */}

              <img
                src="/images/landing-page/advocanote-book-clean.png"
                alt="AdvocaNote AI Smart Legal Diary"
                className="an-bf__book"
                loading="lazy"
                decoding="async"
              />

              {/* BOOK SHADOW */}

              <div
                className="an-bf__shadow"
                aria-hidden="true"
              />

            </div>

            {/* ==================================
          RIGHT SIDE - THREE FEATURES
      ================================== */}

            <div className="an-bf__side an-bf__side--right">

              {[
                {
                  Icon: Mic,
                  title: "Voice to Text",
                  text: "Speak your legal notes and turn them into written diary entries.",
                },
                {
                  Icon: ClipboardCheck,
                  title: "Tasks and Deadlines",
                  text: "Create follow-up tasks and manage important deadlines.",
                },
                {
                  Icon: ScanLine,
                  title: "AI Diary Scan",
                  text: "Convert handwritten diary notes into digital entries for review.",
                  soon: true,
                },
              ].map(
                ({ Icon, title, text, soon }, index) => (

                  <div
                    className="an-bf__feature"
                    key={title}
                    style={{
                      "--feature-delay": `${index * 120}ms`,
                    }}
                  >

                    <div className="an-bf__icon">
                      <Icon
                        size={30}
                        strokeWidth={1.9}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="an-bf__copy">

                      <h3>
                        {title}

                        {soon && (
                          <span className="an-bf__soon">
                            Coming Soon
                          </span>
                        )}
                      </h3>

                      <p>{text}</p>

                    </div>

                    <span
                      className="an-bf__connector"
                      aria-hidden="true"
                    />

                  </div>

                )
              )}

            </div>

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
          PREMIUM FAQ SECTION
      ================================= */}

      <section
        className="an-faq an-faq--modern"
        id="faq"
      >
        <img
          className="an-faq__court"
          src="/images/landing-page/advocanote-courthouse-watermark.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
        />

        <div className="an-shell an-faq-modern">

          {/* HEADER */}

          <div className="an-faq-modern__top">
            <div className="an-faq-modern__intro">

              <span className="an-faq-modern__eyebrow">
                FAQs
              </span>

              <h2>
                Frequently Asked Questions
              </h2>

              <p>
                Everything you need to know about
                AdvocaNote, from managing your legal
                diary to subscriptions and features.
              </p>

            </div>

            <button
              type="button"
              className="an-faq-modern__view"
              aria-expanded={showAllFaq}
              onClick={() =>
                setShowAllFaq((old) => !old)
              }
            >
              {showAllFaq ? "Show less" : "View all"}
              <span aria-hidden="true">
                {showAllFaq ? "−" : "+"}
              </span>
            </button>
          </div>

          {/* FAQ TWO COLUMN GRID */}

          <div className="an-faq-modern__grid">

            {faqColumns.map((column, columnIndex) => (
              <div
                className="an-faq-modern__column"
                key={columnIndex}
              >

                {column.map(({ q, a }, itemIndex) => {
                  const index =
                    columnIndex * 3 + itemIndex;

                  const expanded =
                    showAllFaq || openFaq === index;

                  return (
                    <article
                      key={q}
                      className={`an-faq-v2__item${expanded
                        ? " an-faq-v2__item--open"
                        : ""
                        }`}
                    >

                      <button
                        type="button"
                        className="an-faq-v2__question"
                        aria-expanded={expanded}
                        aria-controls={`an-faq-answer-${index}`}
                        onClick={() => {
                          setShowAllFaq(false);

                          setOpenFaq((old) => {
                            if (showAllFaq) {
                              return index;
                            }

                            return old === index
                              ? -1
                              : index;
                          });
                        }}
                      >
                        <span>{q}</span>

                        <span
                          className="an-faq-v2__symbol"
                          aria-hidden="true"
                        >
                          {expanded ? "−" : "+"}
                        </span>
                      </button>

                      <div
                        className="an-faq-v2__answer"
                        id={`an-faq-answer-${index}`}
                        hidden={!expanded}
                      >
                        <p>{a}</p>
                      </div>

                    </article>
                  );
                })}

              </div>
            ))}

          </div>

          {/* BOTTOM DECORATION */}

          

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
