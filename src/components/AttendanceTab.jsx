export default function AttendanceTab({ players, sessions }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="font-bold mb-4">Attendance & Reports</h2>
      <p className="mb-2 text-gray-600">
        This section will display attendance tracking, player engagement,
        and 6-week reports for parents.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-300 p-2">Player</th>
              <th className="border border-gray-300 p-2">Sessions Attended</th>
              <th className="border border-gray-300 p-2">Attendance %</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const attended = sessions.filter(
                (s) => (s.attendees || []).includes(p.id)
              ).length;
              const total = sessions.length;
              const pct = total ? Math.round((attended / total) * 100) : 0;

              return (
                <tr key={p.id}>
                  <td className="border border-gray-300 p-2">{p.name}</td>
                  <td className="border border-gray-300 p-2">{attended}</td>
                  <td className="border border-gray-300 p-2">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
