export default function ThresholdSlider({ label, value, min, max, onChange, color }) {
  const colorMap = {
    green: 'accent-green-400',
    yellow: 'accent-yellow-400',
    red: 'accent-red-400',
  }

  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-300">{label}</span>
        <span className={`text-lg font-bold ${color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' : 'text-yellow-400'}`}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-700 ${colorMap[color] || 'accent-blue-400'}`}
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
