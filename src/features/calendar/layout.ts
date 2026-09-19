// The verified half-day reservation lane calculation, typed without changing its algorithm.
import type { Booking } from "../dashboard/types";
const day = 86400000,
  date = (d: string) => new Date(d + "T12:00:00Z");
export function segments<
  T extends Pick<Booking, "id" | "arrival" | "checkout">,
>(bookings: T[], weekStart: string) {
  const start = date(weekStart),
    end = new Date(+start + 6 * day).toISOString().slice(0, 10),
    lanes: number[] = [];
  return bookings
    .filter((b) => b.arrival.date <= end && b.checkout.date >= weekStart)
    .map((b) => {
      const continuesBefore = b.arrival.date < weekStart,
        continuesAfter = b.checkout.date > end;
      const first = continuesBefore
        ? 0
        : Math.max(
            0,
            Math.round((+date(b.arrival.date) - +start) / day) * 2 + 1,
          );
      const last = continuesAfter
        ? 14
        : Math.min(
            14,
            Math.round((+date(b.checkout.date) - +start) / day) * 2 + 1,
          );
      return {
        booking: b,
        first,
        last: Math.max(first + 1, last),
        continuesBefore,
        continuesAfter,
      };
    })
    .sort(
      (a, b) =>
        a.first - b.first ||
        b.last - a.last ||
        a.booking.id.localeCompare(b.booking.id),
    )
    .map((segment) => {
      let lane = lanes.findIndex((end) => end <= segment.first);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = segment.last;
      return { ...segment, lane };
    });
}
