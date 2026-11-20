// The FAMITENLY activity log as a table (all schools, or one school).
export const when = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Denver", timeZoneName: "short" });

export type LogRow = { id: string; at: Date; user_email: string; action: string; detail: string; school_id: number | null; school: string | null };

export function LogTable({ rows, showSchool = true }: { rows: LogRow[]; showSchool?: boolean }) {
  if (!rows.length) return <p className="adm-empty">Nothing recorded yet.</p>;
  return (
    <div className="adm-tablewrap">
      <table className="adm-table pf-table pf-log">
        <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th>{showSchool && <th scope="col">School</th>}<th scope="col">Details</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{when(r.at)}</td>
              <td>{r.user_email || "—"}</td>
              <td>{r.action}</td>
              {showSchool && <td>{r.school_id ? <a href={`/platform/schools/${r.school_id}`}>{r.school}</a> : "—"}</td>}
              <td>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

