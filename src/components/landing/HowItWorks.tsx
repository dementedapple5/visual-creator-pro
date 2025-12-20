import { useRef, useEffect } from "react";
import { Check, User, Sparkles, Layout, Palette } from "lucide-react";

const steps = [
    {
        title: "Start with your Identity",
        description: "Upload your face once and reuse it freely. Choose expressions that match your video's vibe—excited, serious, or surprised—without taking new photos every time.",
        icon: User,
        image: "/examples/steps/Screenshot 2025-12-16 at 23.42.28.png"
    },
    {
        title: "Add your Elements",
        description: "Place your product, screenshots, or key visuals. Upload generic assets or branded files to fill the composition.",
        icon: Layout,
        image: "/examples/steps/Screenshot 2025-12-16 at 23.42.58.png"
    },
    {
        title: "Hook with Text",
        description: "Add punchy titles and subtitles. Select from high-converting text styles and placements that ensure your thumbnail is readable and click-worthy.",
        icon: Palette,
        image: "/examples/steps/Screenshot 2025-12-16 at 23.43.31.png"
    },
    {
        title: "Style & Background",
        description: "Set the scene with gradients, solid colors, or AI-generated backgrounds. Define the overall visual style, then hit generate to bring it all together.",
        icon: Sparkles,
        image: "/examples/steps/Screenshot 2025-12-16 at 23.44.08.png"
    }
];

export const HowItWorks = () => {
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                    }
                });
            },
            { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
        );

        const elements = document.querySelectorAll(".how-it-works-step");
        elements.forEach((el) => observer.observe(el));

        return () => elements.forEach((el) => observer.unobserve(el));
    }, []);

    return (
        <section className="py-32 px-6 relative overflow-hidden z-10">
            {/* Background Elements */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="container mx-auto max-w-7xl">
                <div className="text-center mb-24 space-y-4">
                    <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60">
                        How Vizion Works
                    </h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        A professional workflow designed for speed. Go from idea to publish-ready thumbnail in four simple steps.
                    </p>
                </div>

                <div className="space-y-32">
                    {steps.map((step, idx) => {
                        const isEven = idx % 2 === 0;
                        const Icon = step.icon;

                        return (
                            <div
                                key={idx}
                                className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12 lg:gap-24 how-it-works-step`}
                                data-animate
                            >
                                {/* Text Side */}
                                <div className="flex-1 space-y-8">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border text-sm font-medium text-rose-500 dark:text-rose-400">
                                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/20 text-[10px] font-bold">
                                            {idx + 1}
                                        </span>
                                        Step {idx + 1}
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-3xl md:text-4xl font-bold text-foreground">
                                            {step.title}
                                        </h3>
                                        <p className="text-lg text-muted-foreground leading-relaxed">
                                            {step.description}
                                        </p>
                                    </div>

                                    <ul className="space-y-3">
                                        {['Professional presets', 'Time-saving automation', 'Agency-quality output'].map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-foreground/80">
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                                                    <Check className="w-3.5 h-3.5 text-rose-500" />
                                                </div>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Image Side */}
                                <div className="flex-1 w-full">
                                    <div className="relative group perspective-1000">
                                        <div className="relative rounded-2xl border border-border bg-card/50 overflow-hidden shadow-2xl transition-transform duration-500 hover:rotate-x-2">
                                            {/* Glass overlay effect */}
                                            <div className="absolute inset-0 bg-gradient-to-tr from-foreground/5 to-transparent pointer-events-none z-10" />

                                            <img
                                                src={step.image}
                                                alt={step.title}
                                                className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
