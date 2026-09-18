"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import type { CourseReviewSummary } from "@/app/components/course/CourseClassroom"

export function CourseReviews({
  courseSlug,
  initial,
  canWrite,
  isLoggedIn,
  loginHref,
}: {
  courseSlug: string
  initial: CourseReviewSummary
  canWrite: boolean
  isLoggedIn: boolean
  loginHref: string
}) {
  const [reviews, setReviews] = useState(initial)
  const [rating, setRating] = useState(initial.mine?.rating ?? 0)
  const [comment, setComment] = useState(initial.mine?.comment ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    if (rating < 1) {
      setError("Escolha uma nota de 1 a 5")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/catalog/courses/${courseSlug}/reviews`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      })
      const data = await res.json() as CourseReviewSummary & { error?: string }
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar a avaliação")
      setReviews(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a avaliação")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="course-landing-section">
      <h2 className="course-landing-kicker">Avaliações</h2>
      <p className="muted-2">
        {reviews.count > 0 && reviews.average != null
          ? `${reviews.average.toFixed(1)} · ${reviews.count} ${reviews.count === 1 ? "avaliação" : "avaliações"}`
          : "Nenhuma avaliação ainda"}
      </p>

      {canWrite ? (
        <form
          className="card card-form course-landing-review-form"
          onSubmit={(e) => { e.preventDefault(); void submit() }}
        >
          <fieldset className="field">
            <legend className="field-label">Sua nota</legend>
            <div className="course-landing-stars" role="radiogroup" aria-label="Nota">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`icon-btn${rating >= value ? " is-on" : ""}`}
                  aria-label={`${value} de 5`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                >
                  <Star size={16} fill={rating >= value ? "currentColor" : "none"} aria-hidden />
                </button>
              ))}
            </div>
          </fieldset>
          <label className="field" htmlFor="course-review-comment">
            <span className="field-label">Comentário (opcional)</span>
            <textarea
              id="course-review-comment"
              className="input"
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          {error ? <p className="alert alert-err" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {reviews.mine ? "Atualizar avaliação" : "Enviar avaliação"}
          </button>
        </form>
      ) : isLoggedIn ? (
        <p className="muted-2">Assine o plano do curso para avaliar.</p>
      ) : (
        <p className="muted-2">
          <a href={loginHref}>Entre</a> com acesso ao curso para avaliar.
        </p>
      )}

      {reviews.items.length > 0 && (
        <ul className="course-landing-review-list">
          {reviews.items.map((item) => (
            <li key={item.id} className="course-landing-review">
              <p>
                <strong>{item.authorName}</strong>
                <span className="muted-2"> · {item.rating}/5</span>
              </p>
              {item.comment ? <p>{item.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
