export type ComparisonColumn = {
  id: string;
  name: string;
};

export type ComparisonRow = {
  id: string;
  label: string;
  values: Record<string, string>;
  emphasis?: boolean;
};

export function OptionComparison({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
}) {
  return (
    <table className="comparison">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Measure</th>
          {columns.map((column) => (
            <th key={column.id} scope="col">
              {column.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th scope="row">{row.label}</th>
            {columns.map((column) => (
              <td key={column.id} data-option={column.name} className={row.emphasis ? "emphasis" : undefined}>
                {row.values[column.id] ?? "Unknown"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
