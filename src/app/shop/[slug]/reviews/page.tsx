"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ArrowLeft, Loader2 } from "lucide-react";

interface Review {
  id: string;
  customerName: string;
  rating: number;
  comment: string | null;
  imageUrl: string | null;
  createdAt: string;
}

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-6 w-6" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${sizeClass} ${
            i <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const params = useParams<{ slug: string }>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 10;

  const fetchReviews = useCallback(async (p: number) => {
    const res = await fetch(`/api/public/shop/${params.slug}/reviews?page=${p}&pageSize=${pageSize}`);
    if (!res.ok) throw new Error("Failed to fetch reviews");
    const json = await res.json();
    return json.data;
  }, [params.slug]);

  useEffect(() => {
    fetchReviews(1).then((data) => {
      setReviews(data.reviews);
      setAverageRating(data.averageRating);
      setReviewCount(data.reviewCount);
      setTotal(data.total);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [fetchReviews]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await fetchReviews(nextPage);
      setReviews((prev) => [...prev, ...data.reviews]);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = reviews.length < total;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/shop/${params.slug}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Reviews</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StarDisplay rating={averageRating} size="sm" />
              <span className="font-semibold text-sm">{averageRating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">({reviewCount} reviews)</span>
            </div>
          </div>
        </div>

        {/* Rating Breakdown */}
        <Card className="mb-6">
          <CardContent className="p-6 flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold">{averageRating.toFixed(1)}</div>
              <StarDisplay rating={averageRating} size="md" />
              <p className="text-sm text-muted-foreground mt-1">{reviewCount} reviews</p>
            </div>
          </CardContent>
        </Card>

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StarDisplay rating={review.rating} size="sm" />
                      <span className="font-medium text-sm">{review.customerName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                  )}
                  {review.imageUrl && (
                    <img
                      src={review.imageUrl}
                      alt="Review"
                      className="mt-3 rounded-lg max-h-48 object-cover"
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
