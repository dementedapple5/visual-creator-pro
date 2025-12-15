import { useState, useEffect, useCallback } from "react";

// Sarcastic/funny messages about AI image generation
const GENERATING_MESSAGES = [
    "Teaching robots to paint...",
    "Stealing jobs from artists worldwide...",
    "Replacing human creativity since 2024...",
    "Making Getty Images lawyers nervous...",
    "Definitely not training on copyrighted content...",
    "Destroying the art industry one pixel at a time...",
    "Your traditional artist friends hate this...",
    "Please don't post this on Twitter/X...",
    "Concept artists are shaking rn...",
    "This totally counts as 'real art'...",
    "Making illustrators cry since GPT-3...",
    "Soulless? Nah, we prefer 'efficiency'...",
    "Who needs art school anyway?...",
    "Midjourney walked so we could run...",
    "DeviantArt artists are typing...",
    "Watermarks are just suggestions...",
    "Generating something 'original'...",
    "The AI uprising starts here...",
    "Absolutely not learning from your photos...",
    "Making 'creative differences' obsolete...",
    "This is fine. Everything is fine...",
    "Your portfolio is now redundant...",
    "Ethical concerns? What ethical concerns?...",
    "OpenAI legal team enters the chat...",
    "Brushes? Where we're going, we don't need brushes...",
];

interface GeneratingMessagesProps {
    className?: string;
}

export const GeneratingMessages = ({ className = "" }: GeneratingMessagesProps) => {
    const [currentMessage, setCurrentMessage] = useState("");
    const [displayText, setDisplayText] = useState("");
    const [isTyping, setIsTyping] = useState(true);
    const [messageIndex, setMessageIndex] = useState(0);

    // Get a random message (different from current one)
    const getNextMessage = useCallback(() => {
        const availableIndices = GENERATING_MESSAGES.map((_, i) => i).filter(i => i !== messageIndex);
        const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        return { message: GENERATING_MESSAGES[randomIndex], index: randomIndex };
    }, [messageIndex]);

    // Initialize with a random message
    useEffect(() => {
        const { message, index } = getNextMessage();
        setCurrentMessage(message);
        setMessageIndex(index);
    }, []);

    // Typewriter effect
    useEffect(() => {
        if (!currentMessage) return;

        let timeout: NodeJS.Timeout;

        if (isTyping) {
            // Typing in
            if (displayText.length < currentMessage.length) {
                timeout = setTimeout(() => {
                    setDisplayText(currentMessage.slice(0, displayText.length + 1));
                }, 40 + Math.random() * 30); // Variable speed for natural feel
            } else {
                // Done typing, wait then start erasing
                timeout = setTimeout(() => {
                    setIsTyping(false);
                }, 2000); // Pause at full message
            }
        } else {
            // Erasing
            if (displayText.length > 0) {
                timeout = setTimeout(() => {
                    setDisplayText(displayText.slice(0, -1));
                }, 20); // Faster erasing
            } else {
                // Done erasing, get next message
                const { message, index } = getNextMessage();
                setCurrentMessage(message);
                setMessageIndex(index);
                setIsTyping(true);
            }
        }

        return () => clearTimeout(timeout);
    }, [currentMessage, displayText, isTyping, getNextMessage]);

    return (
        <p className={`text-sm text-muted-foreground font-mono ${className}`}>
            <span>{displayText}</span>
            <span
                className="inline-block w-[2px] h-4 bg-primary ml-0.5 align-middle"
                style={{
                    animation: "blink 1s step-end infinite",
                }}
            />
            <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
        </p>
    );
};
