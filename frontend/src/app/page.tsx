"use client";

import Link from "next/link";
import { BackgroundEffects, Button, GlassPanel, Icon } from "@/components/ui";
import { Header, Footer } from "@/components/layout";

// Feature card data
const features = [
  {
    icon: "flash_on",
    title: "Real-Time Combat",
    description:
      "Face opponents in live 1v1 algorithmic battles. Your code executes in real-time with instant feedback.",
  },
  {
    icon: "social_leaderboard",
    title: "Ranked Matchmaking",
    description:
      "Our Glicko-2 rating system ensures fair matches. Rise through the ranks from Novice to Shogun.",
  },
  {
    icon: "electric_bolt",
    title: "AI-Powered Judge",
    description:
      "Instant, intelligent feedback on your submissions. No waiting—know if you solved it immediately.",
  },
];

// Stats data
const stats = [
  { value: "2.5K+", label: "Active Warriors" },
  { value: "15ms", label: "Avg Latency" },
  { value: "TOP 1%", label: "Elite Tier", highlight: true },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <BackgroundEffects showGrid={false} />

      {/* Japanese decorative watermark */}
      <div className="absolute top-32 right-[10%] text-[15rem] font-japanese font-bold text-white/[0.02] select-none leading-none z-0 pointer-events-none hidden lg:block">
        戦
      </div>

      {/* Vertical Japanese text */}
      <div className="absolute bottom-40 left-10 text-xs font-japanese text-white/10 tracking-[1em] select-none z-0 hidden md:block [writing-mode:vertical-rl]">
        アルゴリズム戦争・開始
      </div>

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center w-full">
        {/* Hero Section */}
        <section className="w-full max-w-[1400px] px-6 py-20 md:py-32 flex flex-col items-center text-center relative">
          {/* Rotating decoration */}
          <div className="absolute top-20 left-[15%] w-16 h-16 border border-white/5 rounded-full flex items-center justify-center animate-slow-spin pointer-events-none hidden md:flex opacity-50">
            <div className="w-2 h-2 bg-primary rounded-full absolute top-0" />
          </div>

          {/* Season badge */}
          <div className="mb-8 animate-float">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
                Season 1 Now Live
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-8xl font-bold tracking-tighter text-white mb-6 leading-[0.9]">
            CODE.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-500">
              COMPETE.
            </span>
            <br />
            CONQUER.
          </h1>

          {/* Subheadline */}
          <p className="text-text-muted text-sm md:text-lg max-w-xl mx-auto mb-10 leading-relaxed font-mono">
            The arena for elite developers. Real-time 1v1 algorithmic combat.
            Prove your skill through code efficiency.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Link href="/queue">
              <Button
                variant="primary"
                size="lg"
                leftIcon="swords"
                className="min-w-[200px]"
              >
                Find Match
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button
                variant="secondary"
                size="lg"
                rightIcon="arrow_forward"
                className="min-w-[200px]"
              >
                View Leaderboard
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1 items-center">
                <span
                  className={`text-2xl md:text-3xl font-bold font-mono ${
                    stat.highlight ? "text-primary" : "text-white"
                  }`}
                >
                  {stat.value}
                </span>
                <span className="text-[10px] text-text-muted uppercase tracking-widest">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full max-w-[1200px] px-6 pb-24 grid md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <GlassPanel
              key={feature.title}
              showCornerAccents={false}
              padding="p-8"
              className="group hover:bg-white/5 transition-all duration-300"
            >
              {/* Top gradient line on hover */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Icon */}
              <div className="size-12 bg-white/5 border border-white/10 rounded flex items-center justify-center mb-6 group-hover:border-primary/50 transition-colors">
                <Icon name={feature.icon} size={24} className="text-white" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-white uppercase tracking-wide mb-3">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-text-muted text-sm leading-relaxed">
                {feature.description}
              </p>
            </GlassPanel>
          ))}
        </section>

        {/* How It Works Section */}
        <section className="w-full border-y border-white/5 bg-card-dark/50 backdrop-blur-sm">
          <div className="max-w-[1200px] mx-auto px-6 py-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4 uppercase tracking-tight">
              How It <span className="text-primary">Works</span>
            </h2>
            <p className="text-text-muted text-center mb-12 max-w-xl mx-auto">
              Three steps to prove your algorithmic prowess
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Enter Queue",
                  desc: "Join the matchmaking queue and get paired with an opponent of similar skill.",
                  icon: "queue",
                },
                {
                  step: "02",
                  title: "Battle",
                  desc: "Race to solve the same algorithmic problem. First to submit a correct solution wins.",
                  icon: "code",
                },
                {
                  step: "03",
                  title: "Climb Ranks",
                  desc: "Win matches to increase your rating and climb the global leaderboard.",
                  icon: "trending_up",
                },
              ].map((item) => (
                <div key={item.step} className="flex flex-col items-center text-center">
                  <div className="text-4xl font-black text-white/10 mb-4 font-display">
                    {item.step}
                  </div>
                  <div className="size-14 rounded-full border border-primary/30 flex items-center justify-center mb-4 bg-primary/5">
                    <Icon name={item.icon} size={24} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-wide mb-2">
                    {item.title}
                  </h3>
                  <p className="text-text-muted text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-24 px-6 flex flex-col items-center text-center relative overflow-hidden">
          {/* Glow effect */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px]" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            {/* Icon */}
            <div className="size-20 rounded-full border-2 border-primary/30 flex items-center justify-center bg-card-dark mb-8 shadow-[0_0_30px_rgba(255,51,68,0.2)]">
              <Icon name="swords" size={40} className="text-primary" />
            </div>

            {/* Headline */}
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-none mb-6">
              Enter the
              <br />
              <span className="text-primary">Arena</span>
            </h2>

            {/* Subtext */}
            <p className="text-text-muted text-lg max-w-[600px] mb-10">
              Join thousands of developers competing daily. Prove your skills,
              climb the leaderboard, and claim your rank as Shogun.
            </p>

            {/* CTA Button */}
            <Link href="/signup">
              <Button
                variant="primary"
                size="lg"
                rightIcon="arrow_forward"
                className="min-w-[300px] h-14 text-base"
              >
                Create Account
              </Button>
            </Link>

            {/* Japanese text */}
            <p className="text-xs font-japanese text-white/20 mt-6 tracking-widest">
              戦いの準備はできていますか
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />

      {/* Bottom decorative lines */}
      <div className="fixed bottom-0 left-0 w-full flex justify-between px-12 pb-6 z-20 pointer-events-none opacity-30">
        <div className="h-[1px] w-24 bg-gradient-to-r from-transparent to-primary" />
        <div className="h-[1px] w-24 bg-gradient-to-l from-transparent to-primary" />
      </div>
    </div>
  );
}
