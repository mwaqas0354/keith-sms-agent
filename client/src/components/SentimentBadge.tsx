const styles: Record<string, string> = {
  positive: 'text-emerald-400',
  neutral: 'text-slate-400',
  negative: 'text-red-400',
  frustrated: 'text-orange-400',
};

export default function SentimentBadge({ sentiment }: { sentiment: string }) {
  return (
    <span className={`text-[10px] capitalize ${styles[sentiment] || styles.neutral}`}>
      {sentiment}
    </span>
  );
}
