import { useRef, useEffect } from "react";

const examples = [
    "5 HISTORIAS TERRORIFICAS-1280x720.png",
    "DJI Osmo Action 6-1280x720.png",
    "How to Cook the Perfect Lasagna!!-1280x720.png",
    "Mi Primera Victory Royale!!-1280x720.png",
    "This Helped me To Make My 1st Million-1280x720.png",
    "thumbnail-1280x720 (2).png",
    "thumbnail-1280x720 (3).png",
    "5 HISTORIAS TERRORIFICAS-1280x720.png",
    "DJI Osmo Action 6-1280x720.png",
    "How to Cook the Perfect Lasagna!!-1280x720.png",
    "Mi Primera Victory Royale!!-1280x720.png",
    "This Helped me To Make My 1st Million-1280x720.png",
    "thumbnail-1280x720 (2).png",
    "thumbnail-1280x720 (3).png",
];

export const InfiniteScrollExamples = () => {
    return (
        <div className="w-full py-24 overflow-hidden bg-background/50 backdrop-blur-sm relative border-y border-border">
            <div className="container mx-auto px-6 mb-12 text-center relative z-20">
                <h2 className="text-3xl md:text-5xl font-bold mb-6 text-foreground">Made with Vizion</h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    From viral hits to brand builders, see what creators are shipping.
                </p>
            </div>

            <div className="relative w-full">
                <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background z-10 pointer-events-none" />

                <div className="flex gap-4 animate-scroll-left hover:[animation-play-state:paused]" style={{ width: "max-content" }}>
                    {/* First set of images */}
                    {examples.map((filename, i) => (
                        <div
                            key={`orig-${i}`}
                            className="relative h-[240px] aspect-video rounded-xl overflow-hidden shadow-2xl border border-border group cursor-pointer transition-transform duration-300 hover:scale-[1.02] hover:shadow-primary/20"
                        >
                            <img
                                src={`/examples/${filename}`}
                                alt={`Example thumbnail ${i + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300" />
                        </div>
                    ))}
                    {/* Duplicate set for infinite scroll effect */}
                    {examples.map((filename, i) => (
                        <div
                            key={`dup-${i}`}
                            className="relative h-[240px] aspect-video rounded-xl overflow-hidden shadow-2xl border border-border group cursor-pointer transition-transform duration-300 hover:scale-[1.02] hover:shadow-primary/20"
                        >
                            <img
                                src={`/examples/${filename}`}
                                alt={`Example thumbnail ${i + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
