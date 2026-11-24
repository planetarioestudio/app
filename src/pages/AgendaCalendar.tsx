import { useState } from "react";
import { Button, Section } from "../components";
import type { Session } from "../lib/types";
import { localDateTime, today } from "../lib/utils";

const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const key = (date: Date) => date.toISOString().slice(0, 10);
const dateAtNoon = (day: string) => new Date(`${day}T12:00:00Z`);
const monday = (day: string) => {
  const date = dateAtNoon(day);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date;
};

export function AgendaCalendar({
  sessions,
  month,
  setMonth,
  onEdit,
}: {
  sessions: Session[];
  month: string;
  setMonth: (month: string) => void;
  onEdit: (session: Session) => void;
}) {
  const [view, setView] = useState<"month" | "week">("month");
  const [week, setWeek] = useState(today());
  const start = view === "month" ? monday(`${month}-01`) : monday(week);
  const days = Array.from({ length: view === "month" ? 42 : 7 }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    return key(date);
  });
  function move(amount: number) {
    if (view === "month") {
      const [year, currentMonth] = month.split("-").map(Number);
      const target = new Date(Date.UTC(year!, currentMonth! - 1 + amount, 1));
      setMonth(key(target).slice(0, 7));
    } else {
      const date = dateAtNoon(week);
      date.setUTCDate(date.getUTCDate() + amount * 7);
      setWeek(key(date));
    }
  }
  return (
    <Section
      title="Calendário"
      action={
        <div className="button-row">
          <Button
            variant={view === "month" ? "primary" : "quiet"}
            onClick={() => setView("month")}
          >
            Mês
          </Button>
          <Button
            variant={view === "week" ? "primary" : "quiet"}
            onClick={() => {
              setView("week");
              setWeek(`${month}-01`);
            }}
          >
            Semana
          </Button>
          <Button
            variant="quiet"
            onClick={() => move(-1)}
            aria-label="Período anterior"
          >
            ←
          </Button>
          <Button
            variant="quiet"
            onClick={() => move(1)}
            aria-label="Próximo período"
          >
            →
          </Button>
        </div>
      }
    >
      <div className="calendar-label">
        {view === "month"
          ? new Intl.DateTimeFormat("pt-BR", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(dateAtNoon(`${month}-01`))
          : `${days[0]} a ${days[6]}`}
      </div>
      <div className="calendar-grid">
        {weekdays.map((day) => (
          <strong className="calendar-weekday" key={day}>
            {day}
          </strong>
        ))}
        {days.map((day) => (
          <div
            key={day}
            className={`calendar-day ${day.slice(0, 7) !== month && view === "month" ? "outside" : ""} ${day === today() ? "today" : ""}`}
          >
            <span>{day.slice(8, 10)}</span>
            {sessions
              .filter(
                (s) =>
                  localDateTime(s.startAt).slice(0, 10) === day &&
                  !["cancelada", "não compareceu"].includes(s.status),
              )
              .sort((a, b) => a.startAt.localeCompare(b.startAt))
              .map((s) => (
                <button
                  key={s.id}
                  className="calendar-event"
                  onClick={() => onEdit(s)}
                  title={`Editar sessão ${localDateTime(s.startAt)}`}
                >
                  {localDateTime(s.startAt).slice(11, 16)} · {s.status}
                </button>
              ))}
          </div>
        ))}
      </div>
    </Section>
  );
}
