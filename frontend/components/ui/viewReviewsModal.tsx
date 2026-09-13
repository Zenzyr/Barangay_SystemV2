"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Star, UserRound, MessageSquareText, X, Briefcase, ChevronRight } from "lucide-react";

interface Review {
  _id?: string;
  user: string;
  userProfile: string;
  star: number;
  skill: string;
  message: string;
}

interface ViewReviewsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  residentName: string;
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

function StarRow({ rating, size = "sm" }: { rating: number; size?: "sm" | "xs" }) {
  const starSize = size === "sm" ? "size-4" : "size-3";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`${starSize} ${
            value <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function ViewReviewsModal({
  open,
  onOpenChange,
  residentName,
  reviews,
  averageRating,
  totalReviews,
}: ViewReviewsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg bg-white rounded-2xl p-0 gap-0 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-100 shrink-0">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-sm">
                  <MessageSquareText className="size-5 text-amber-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Reviews
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    Feedback for {residentName}
                  </DialogDescription>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </DialogHeader>

          {/* Rating Summary */}
          {totalReviews > 0 && (
            <div className="mt-4 flex items-center gap-4 p-3 rounded-xl bg-amber-50/50 border border-amber-100">
              <div className="text-center">
                <span className="text-2xl font-bold text-gray-900">
                  {averageRating > 0 ? averageRating.toFixed(1) : "—"}
                </span>
                <span className="text-xs text-gray-500 block">out of 5</span>
              </div>
              <div className="flex-1">
                <StarRow rating={Math.round(averageRating)} />
                <p className="text-xs text-gray-500 mt-1">
                  {totalReviews} {totalReviews === 1 ? "review" : "reviews"} total
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Reviews List */}
        <div className="p-6 space-y-3 overflow-y-auto">
          {reviews.length === 0 ? (
            <div className="text-center py-8">
              <div className="size-12 rounded-full bg-gray-50 mx-auto flex items-center justify-center mb-3">
                <MessageSquareText className="size-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No reviews yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Reviews from neighbors will appear here
              </p>
            </div>
          ) : (
            reviews.map((review, index) => (
              <div
                key={review._id || index}
                className="p-4 rounded-xl border border-gray-100 bg-white hover:border-amber-100 hover:shadow-sm transition-all duration-200"
              >
                {/* Reviewer info & rating */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
                      {review.userProfile ? (
                        <img
                          src={review.userProfile}
                          alt={review.user}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <UserRound className="size-4 text-sky-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {review.user}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <Briefcase className="size-3" />
                        <span className="truncate">{review.skill}</span>
                      </div>
                    </div>
                  </div>
                  <StarRow rating={review.star} size="xs" />
                </div>

                {/* Message */}
                <p className="text-sm text-gray-600 leading-relaxed ml-[42px]">
                  {review.message}
                </p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
