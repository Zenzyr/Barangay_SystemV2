"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Star, MessageSquareText, X } from "lucide-react";

interface SkillItem {
  _id: string;
  skill: string;
  experience: number;
  proficiency: string;
}

interface AddReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  residentName: string;
  residentSkills: SkillItem[];
  onAdd: (review: {
    star: number;
    skill: string;
    message: string;
  }) => Promise<void>;
}

export default function AddReviewModal({
  open,
  onOpenChange,
  residentName,
  residentSkills,
  onAdd,
}: AddReviewModalProps) {
  const [star, setStar] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [skill, setSkill] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setStar(0);
    setHoveredStar(0);
    setSkill("");
    setMessage("");
  };

  const handleSubmit = async () => {
    if (star === 0 || !skill || !message.trim()) return;

    setLoading(true);
    try {
      await onAdd({ star, skill, message: message.trim() });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md bg-white rounded-2xl p-0 gap-0"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-sm">
                  <Star className="size-5 text-amber-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Write a Review
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    Rate your experience with {residentName}
                  </DialogDescription>
                </div>
              </div>
              <button
                onClick={() => {
                  resetForm();
                  onOpenChange(false);
                }}
                className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* Star Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Rating
            </Label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStar(value)}
                  onMouseEnter={() => setHoveredStar(value)}
                  onMouseLeave={() => setHoveredStar(0)}
                  className="p-1 transition-all duration-150 hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`size-7 transition-all duration-150 ${
                      value <= (hoveredStar || star)
                        ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                        : "fill-gray-200 text-gray-200"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm font-medium text-gray-500">
                {star > 0
                  ? `${star} ${star === 1 ? "star" : "stars"}`
                  : "Select rating"}
              </span>
            </div>
          </div>

          {/* Skill Selection */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Skill Being Reviewed
            </Label>
            <Select value={skill} onValueChange={setSkill}>
              <SelectTrigger className="w-full h-10 border-gray-200 focus:border-amber-400">
                <SelectValue placeholder="Select a skill..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {residentSkills.map((s) => (
                  <SelectItem key={s._id} value={s.skill}>
                    {s.skill}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label
              htmlFor="review-message"
              className="text-sm font-medium text-gray-700"
            >
              Feedback / Review
            </Label>
            <Textarea
              id="review-message"
              placeholder="Share your experience working with this resident..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-24 border-gray-200 focus:border-amber-400 resize-y"
            />
          </div>

          {/* Validation hints */}
          <div className="space-y-1 text-xs text-gray-400">
            {star === 0 && <p>Select a star rating</p>}
            {!skill && <p>Select which skill you are reviewing</p>}
            {!message.trim() && (
              <p>Write a brief feedback message</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            className="h-9 border-gray-200 text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || star === 0 || !skill || !message.trim()}
            className="h-9 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium shadow-lg shadow-amber-200/50 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <MessageSquareText className="size-4" />
                Submit Review
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
