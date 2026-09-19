"use client";
import { useEffect, useRef, useState } from "react";
import RichText from "./RichText";
import type { PrivateContent } from "./types";
const reminders = [
  "Use the Tapo app where your host has provided access.",
  "Check and restock guest essentials before you leave.",
  "Always check the calendar for your next clean. Don’t rely on WhatsApp notifications.",
  "Use the property checklist during every clean. Your progress is saved to your workspace.",
  "Report damage, missing items or maintenance issues to the host as soon as possible.",
];
export default function Reminder({
  content,
  visible,
}: {
  content: PrivateContent | null;
  visible: boolean;
}) {
  const [index, setIndex] = useState(0),
    [started, setStarted] = useState(false),
    [paused, setPaused] = useState(false),
    [fading, setFading] = useState(false),
    area = useRef<HTMLElement>(null),
    pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setPaused(media.matches); setFading(false); };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const timer = setInterval(
      () => {
        if (
          pausedRef.current ||
          !visible ||
          document.hidden ||
          area.current?.matches(":hover,:focus-within")
        )
          return;
        setFading(true);
        timeout = setTimeout(
          () => {
            if (!pausedRef.current) {
              setStarted(true);
              setIndex(
                (i) =>
                  (i + 1) % (content?.reminders.length || reminders.length),
              );
            }
            setFading(false);
          },
          content ? 200 : 160,
        );
      },
      content ? 5000 : 10000,
    );
    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [content, visible]);
  return (
    <section
      ref={area}
      className="hero info-banner workspace-reminder"
      aria-label="Cleaner reminder"
    >
      <div className="reminder-toolbar">
        <span className="reminder-caption">Cleaner reminder</span>
        <button
          className="reminder-toggle"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "Resume reminders" : "Pause reminders"}
        </button>
      </div>
      {content?.reminders.length ? (
        <div className="reminders" role="region" aria-label="Cleaner reminders">
          <p className={"reminder active" + (fading ? " fading" : "")}>
            <RichText nodes={content.reminders[index]} />
          </p>
        </div>
      ) : (
        <p id="workspaceReminder" className={fading ? "fading" : ""}>
          {started
            ? reminders[index]
            : "Always check the calendar for your next clean. Don’t rely on WhatsApp notifications."}
        </p>
      )}
    </section>
  );
}
