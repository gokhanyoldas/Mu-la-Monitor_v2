import { Shield, Star, AlertTriangle } from "lucide-react";

interface SourceReliabilityItem {
  platform: string;
  source_name: string;
  total_posts: number;
  reliability_score: number;
}

interface SourceReliabilityProps {
  sources: SourceReliabilityItem[];
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return "text-green-500";
  if (score >= 0.6) return "text-cyan-400";
  if (score >= 0.4) return "text-yellow-500";
  return "text-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 0.8) return "Güvenilir";
  if (score >= 0.6) return "Orta";
  if (score >= 0.4) return "Düşük";
  return "Şüpheli";
}

function getScoreIcon(score: number) {
  if (score >= 0.8) return <Shield size={10} className="text-green-500" />;
  if (score >= 0.6) return <Star size={10} className="text-cyan-400" />;
  return <AlertTriangle size={10} className="text-yellow-500" />;
}

export const SourceReliability = ({ sources }: SourceReliabilityProps) => {
  const sorted = [...sources].sort((a, b) => b.reliability_score - a.reliability_score);

  if (sorted.length === 0) {
    return (
      <div className="text-[10px] font-mono text-muted-foreground/50 text-center py-3">
        Kaynak güvenilirlik verileri toplanıyor...
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {sorted.slice(0, 10).map((source, i) => (
        <div key={`${source.platform}-${source.source_name}`} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/10 border border-border/20">
          <span className="text-[9px] font-mono text-muted-foreground/50 w-3">{i + 1}</span>
          {getScoreIcon(source.reliability_score)}
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono text-foreground/80 truncate block">{source.source_name}</span>
            <span className="text-[8px] font-mono text-muted-foreground">{source.platform} • {source.total_posts} post</span>
          </div>
          <div className="text-right">
            <span className={`text-[10px] font-mono font-bold ${getScoreColor(source.reliability_score)}`}>
              {Math.round(source.reliability_score * 100)}%
            </span>
            <span className={`text-[8px] font-mono block ${getScoreColor(source.reliability_score)}`}>
              {getScoreLabel(source.reliability_score)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Calculate source reliability from post history
 * Heuristic: frequency + diversity + sentiment consistency
 */
export function calculateReliability(posts: Array<{ author: string; platform: string; sentiment?: string }>): SourceReliabilityItem[] {
  const sourceMap = new Map<string, { platform: string; count: number; sentiments: string[] }>();

  for (const post of posts) {
    const key = `${post.platform}:${post.author}`;
    if (!sourceMap.has(key)) {
      sourceMap.set(key, { platform: post.platform, count: 0, sentiments: [] });
    }
    const entry = sourceMap.get(key)!;
    entry.count++;
    if (post.sentiment) entry.sentiments.push(post.sentiment);
  }

  return Array.from(sourceMap.entries()).map(([key, value]) => {
    const source_name = key.split(":")[1] || "Bilinmeyen";
    
    // Base score from post count (more posts = more reliable, up to a point)
    const countScore = Math.min(value.count / 10, 0.4);
    
    // Bonus for well-known sources
    const knownSources = ["T24", "Bodrum Kent TV", "Muğla Gazetesi", "Ege Alternatif", "NTV", "CNN Türk", "BBC Türkçe"];
    const knownBonus = knownSources.some(s => source_name.includes(s)) ? 0.3 : 0;
    
    // Consistency score (not all positive or all negative = more balanced = higher)
    const uniqueSentiments = new Set(value.sentiments).size;
    const consistencyScore = uniqueSentiments >= 2 ? 0.2 : 0.1;
    
    // Platform trust base
    const platformTrust: Record<string, number> = {
      news: 0.1,
      reddit: 0.05,
      eksisozluk: 0.05,
      twitter: 0.03,
    };

    const score = Math.min(
      countScore + knownBonus + consistencyScore + (platformTrust[value.platform] || 0.05),
      1.0
    );

    return {
      platform: value.platform,
      source_name,
      total_posts: value.count,
      reliability_score: score,
    };
  });
}
