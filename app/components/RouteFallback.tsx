export function PageLoading() {
  return <div className="page"><div className="loading-center">Carregando...</div></div>
}

export function PageError({ reset }: { reset: () => void }) {
  return (
    <div className="page">
      <div className="auth-box">
        <h1 className="page-title">Não foi possível carregar</h1>
        <p className="page-sub">Tente de novo em instantes.</p>
        <button type="button" className="btn btn-primary" onClick={reset}>Tentar novamente</button>
      </div>
    </div>
  )
}
