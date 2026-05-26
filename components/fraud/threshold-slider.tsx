"use client";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  color: "green" | "yellow" | "red";
}

const colorMap = {
  green: "text-green-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
};

export default function ThresholdSlider({ label, value, min, max, onChange, color }: Props) {
  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-300">{label}</span>
        <span className={`text-lg font-bold ${colorMap[color]}`}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-700"
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
