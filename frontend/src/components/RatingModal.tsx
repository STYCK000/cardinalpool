import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { apiRequest } from '../services/api';
import { Spinner, btn, cardCls } from './ui';

interface RatingModalProps {
  bookingId: string;
  targetName: string;
  targetRole: 'DRIVER' | 'RIDER';
  tripSummary: string;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}

const QUICK_TAGS: Record<'DRIVER' | 'RIDER', string[]> = {
  DRIVER: ['Safe driving', 'On time', 'Clean vehicle', 'Friendly & respectful'],
  RIDER: ['Ready at pick-up', 'Punctual', 'Friendly & respectful', 'Great communication'],
};

export const RatingModal: React.FC<RatingModalProps> = ({
  bookingId,
  targetName,
  targetRole,
  tripSummary,
  onClose,
  onSubmitted,
}) => {
  const [stars, setStars] = useState<number>(5);
  const [hoverStars, setHoverStars] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const combinedComment = [
      selectedTags.length > 0 ? selectedTags.join(' · ') : '',
      comment.trim(),
    ]
      .filter(Boolean)
      .join(' — ');

    try {
      const res = await apiRequest<{ message: string }>('/ratings', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          stars,
          comment: combinedComment || undefined,
        }),
      });
      onSubmitted(res.message);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const activeStars = hoverStars || stars;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className={`${cardCls} w-full max-w-md overflow-hidden shadow-2xl`}>
        <div className="flex items-center justify-between bg-cardinal-800 px-5 py-4 text-white">
          <div>
            <h2 className="text-base font-bold">
              Rate {targetRole === 'DRIVER' ? 'Your Driver' : 'Your Rider'}
            </h2>
            <p className="text-xs text-red-200">{tripSummary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-red-200 hover:bg-cardinal-700 hover:text-white"
            aria-label="Close rating modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">
              How was your ride with <span className="text-cardinal-700">{targetName}</span>?
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onMouseEnter={() => setHoverStars(value)}
                  onMouseLeave={() => setHoverStars(0)}
                  onClick={() => setStars(value)}
                  className="rounded-full p-1 transition hover:scale-110 focus:outline-none"
                  aria-label={`${value} star${value > 1 ? 's' : ''}`}
                >
                  <Star
                    className={`h-8 w-8 transition ${
                      value <= activeStars
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs font-semibold text-amber-700">
              {activeStars === 5
                ? 'Excellent!'
                : activeStars === 4
                  ? 'Great ride'
                  : activeStars === 3
                    ? 'Good'
                    : activeStars === 2
                      ? 'Could be better'
                      : 'Poor experience'}
            </p>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-600">Quick highlights</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS[targetRole].map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      selected
                        ? 'border-cardinal-700 bg-cardinal-50 text-cardinal-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Additional comment (optional)
            </label>
            <textarea
              rows={3}
              maxLength={350}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`Share a quick note about ${targetName}...`}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-cardinal-600 focus:outline-none focus:ring-2 focus:ring-cardinal-600/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={btn('secondary', 'sm')}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={btn('primary', 'sm')}>
              {submitting ? <Spinner /> : 'Submit Rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
