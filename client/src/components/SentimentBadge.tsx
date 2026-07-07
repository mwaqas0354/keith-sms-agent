const styles: Record<string, string> = {
  positive: 'text-emerald-700 bg-emerald-50',
  neutral: 'text-luxury-500 bg-luxury-100',
  negative: 'text-red-700 bg-red-50',
  frustrated: 'text-orange-700 bg-orange-50',
};

export default function SentimentBadge({ sentiment }: { sentiment: string }) {
  return (
    <span className={`text-[10px] capitalize px-1.5 py-0.5 rounded-md font-medium ${styles[sentiment] || styles.neutral}`}>
      {sentiment}
    </span>
  );
}
