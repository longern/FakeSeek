import { parse } from "csv-parse/browser/esm/sync";
import { useMemo } from "react";
import { Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

function TrainingResultChart({
  resultCsv,
  width,
  height,
}: {
  resultCsv: string;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
}) {
  const parsedData: {
    step: string;
    "train/loss": string;
  }[] = useMemo(() => {
    return parse(resultCsv, { columns: true, skip_empty_lines: true });
  }, [resultCsv]);

  const chartData = useMemo(() => {
    return parsedData
      .filter((record) => record["train/loss"] !== "")
      .map((record) => ({
        step: record["step"],
        "train/loss": Number(record["train/loss"]).toPrecision(6),
      }));
  }, [parsedData]);

  return (
    <LineChart width={width} height={height} data={chartData} responsive>
      <Line type="monotone" dataKey="train/loss" stroke="#8884d8" />
      <XAxis dataKey="step" />
      <YAxis />
      <Tooltip />
      <Legend />
    </LineChart>
  );
}

export default TrainingResultChart;
