import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [user, setUser] = useState(null)
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddLoan, setShowAddLoan] = useState(false)
  const [showPayment, setShowPayment] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [authError, setAuthError] = useState('')
  const [newLoan, setNewLoan] = useState({
    name: '', principal: '', interest_rate: '', monthly_payment: '',
    tenure: '12', start_date: new Date().toISOString().split('T')[0], category: 'personal'
  })
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  const categories = [
    { value: 'personal', label: 'Personal Loan', color: '#3B82F6' },
    { value: 'business', label: 'Business Loan', color: '#10B981' },
    { value: 'mortgage', label: 'Mortgage', color: '#8B5CF6' },
    { value: 'auto', label: 'Auto Loan', color: '#F59E0B' },
    { value: 'education', label: 'Education', color: '#EC4899' },
    { value: 'other', label: 'Other', color: '#6B7280' }
  ]

  useEffect(() => {
    checkUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchLoans(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
    if (session?.user) await fetchLoans(session.user.id)
    setLoading(false)
  }

  async function fetchLoans(userId) {
    const { data, error } = await supabase.from('loans').select('*, payments(*)').eq('user_id', userId).order('created_at', { ascending: false })
    if (!error && data) {
      const loansWithTotals = data.map(loan => ({
        ...loan, totalPaid: loan.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
      }))
      setLoans(loansWithTotals)
    }
  }

  async function handleAuth(e) {
    e.preventDefault()
    setAuthError('')
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setAuthError(error.message)
      else setAuthError('Check your email for the confirmation link!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setAuthError(error.message)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setLoans([])
  }

  async function handleAddLoan(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('loans').insert([{
      user_id: user.id, name: newLoan.name, principal: parseFloat(newLoan.principal),
      interest_rate: parseFloat(newLoan.interest_rate) || 0, monthly_payment: parseFloat(newLoan.monthly_payment),
      tenure: parseInt(newLoan.tenure) || 12, start_date: newLoan.start_date, category: newLoan.category, status: 'active'
    }]).select()
    if (!error && data) {
      setLoans([{ ...data[0], payments: [], totalPaid: 0 }, ...loans])
      setShowAddLoan(false)
      setNewLoan({ name: '', principal: '', interest_rate: '', monthly_payment: '', tenure: '12', start_date: new Date().toISOString().split('T')[0], category: 'personal' })
    }
  }

  async function handleRecordPayment(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('payments').insert([{ loan_id: showPayment.id, amount: parseFloat(paymentAmount), note: paymentNote }]).select()
    if (!error && data) {
      setLoans(loans.map(loan => {
        if (loan.id === showPayment.id) {
          return { ...loan, payments: [...(loan.payments || []), data[0]], totalPaid: loan.totalPaid + parseFloat(paymentAmount) }
        }
        return loan
      }))
      setShowPayment(null)
      setPaymentAmount('')
      setPaymentNote('')
    }
  }

  async function handleDeleteLoan(loanId) {
    if (confirm('Are you sure you want to delete this loan?')) {
      await supabase.from('loans').delete().eq('id', loanId)
      setLoans(loans.filter(l => l.id !== loanId))
    }
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount)
  }

  function formatCompact(amount) {
    if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `₦${(amount / 1000).toFixed(0)}K`
    return formatMoney(amount)
  }

  function getProgress(loan) { return Math.min((loan.totalPaid / loan.principal) * 100, 100) }
  function getRemaining(loan) { return Math.max(loan.principal - loan.totalPaid, 0) }
  function getCategoryColor(category) { return categories.find(c => c.value === category)?.color || '#6B7280' }

  const stats = loans.reduce((acc, loan) => ({
    totalBorrowed: acc.totalBorrowed + Number(loan.principal),
    totalPaid: acc.totalPaid + loan.totalPaid,
    totalRemaining: acc.totalRemaining + getRemaining(loan),
    monthlyDue: acc.monthlyDue + (loan.status === 'active' ? Number(loan.monthly_payment) : 0)
  }), { totalBorrowed: 0, totalPaid: 0, totalRemaining: 0, monthlyDue: 0 })

  if (loading) {
    return (<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-600">Loading...</p></div></div>)
  }

  if (!user) {
    return (
      <><Head><title>Loan Dashboard - Login</title></Head>
        <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <div className="text-center mb-8"><h1 className="text-2xl font-bold text-gray-900">Loan Dashboard</h1><p className="text-gray-500 mt-2">Track your loan repayments</p></div>
            <form onSubmit={handleAuth} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="you@example.com" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="********" required minLength={6} /></div>
              {authError && <p className={`text-sm ${authError.includes('Check your email') ? 'text-green-600' : 'text-red-600'}`}>{authError}</p>}
              <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">{isSignUp ? 'Create Account' : 'Sign In'}</button>
            </form>
            <p className="text-center mt-6 text-sm text-gray-600">{isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}<button onClick={() => { setIsSignUp(!isSignUp); setAuthError('') }} className="text-blue-600 font-medium hover:underline">{isSignUp ? 'Sign In' : 'Create Account'}</button></p>
          </div>
        </div>
      </>
    )
  }

  return (
    <><Head><title>Loan Dashboard</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div><h1 className="text-xl font-bold text-gray-900">Loan Dashboard</h1><p className="text-sm text-gray-500">{user.email}</p></div>
              <div className="flex gap-2"><button onClick={() => setShowAddLoan(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">+ Add Loan</button><button onClick={handleLogout} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Logout</button></div>
            </div>
            <div className="flex gap-1 mt-4">{['overview', 'loans'].map(tab => (<button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === tab ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>))}</div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 shadow-sm"><p className="text-sm text-gray-500 mb-1">Total Borrowed</p><p className="text-2xl font-bold text-gray-900">{formatCompact(stats.totalBorrowed)}</p></div>
                <div className="bg-white rounded-xl p-5 shadow-sm"><p className="text-sm text-gray-500 mb-1">Total Paid</p><p className="text-2xl font-bold text-green-600">{formatCompact(stats.totalPaid)}</p></div>
                <div className="bg-white rounded-xl p-5 shadow-sm"><p className="text-sm text-gray-500 mb-1">Outstanding</p><p className="text-2xl font-bold text-orange-600">{formatCompact(stats.totalRemaining)}</p></div>
                <div className="bg-white rounded-xl p-5 shadow-sm"><p className="text-sm text-gray-500 mb-1">Monthly Due</p><p className="text-2xl font-bold text-purple-600">{formatCompact(stats.monthlyDue)}</p></div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Loans</h3>
                {loans.filter(l => l.status === 'active').length === 0 ? (
                  <div className="text-center py-8"><p className="text-gray-500 mb-4">No active loans yet</p><button onClick={() => setShowAddLoan(true)} className="text-blue-600 font-medium hover:underline">Add your first loan</button></div>
                ) : (
                  <div className="space-y-3">{loans.filter(l => l.status === 'active').map(loan => (
                    <div key={loan.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: getCategoryColor(loan.category) + '20' }}><div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(loan.category) }}></div></div>
                      <div className="flex-1 min-w-0"><h4 className="font-medium text-gray-900 truncate">{loan.name}</h4><div className="w-full bg-gray-200 rounded-full h-2 mt-2"><div className="h-2 rounded-full" style={{ width: `${getProgress(loan)}%`, backgroundColor: getCategoryColor(loan.category) }} /></div><p className="text-xs text-gray-500 mt-1">{getProgress(loan).toFixed(0)}% paid</p></div>
                      <div className="text-right"><p className="font-semibold text-gray-900">{formatCompact(getRemaining(loan))}</p><p className="text-xs text-gray-500">remaining</p></div>
                      <button onClick={() => { setShowPayment(loan); setPaymentAmount(String(loan.monthly_payment)) }} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Pay</button>
                    </div>
                  ))}</div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'loans' && (
            <div className="space-y-4">
              {loans.length === 0 ? (
                <div className="bg-white rounded-xl p-12 shadow-sm text-center"><h3 className="text-lg font-semibold text-gray-900 mb-2">No loans yet</h3><p className="text-gray-500 mb-4">Add your first loan to start tracking</p><button onClick={() => setShowAddLoan(true)} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700">Add Loan</button></div>
              ) : (
                loans.map(loan => (
                  <div key={loan.id} className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: getCategoryColor(loan.category) + '20' }}><div className="w-4 h-4 rounded-full" style={{ backgroundColor: getCategoryColor(loan.category) }}></div></div>
                        <div><h3 className="font-semibold text-gray-900">{loan.name}</h3><p className="text-sm text-gray-500">{categories.find(c => c.value === loan.category)?.label}</p></div>
                      </div>
                      <div className="flex gap-2">
                        {loan.status === 'active' && <button onClick={() => { setShowPayment(loan); setPaymentAmount(String(loan.monthly_payment)) }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Record Payment</button>}
                        <button onClick={() => handleDeleteLoan(loan.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">Delete</button>
                      </div>
                    </div>
                    <div className="mb-4"><div className="flex justify-between text-sm mb-2"><span className="text-gray-600">Progress</span><span className="font-medium">{getProgress(loan).toFixed(1)}%</span></div><div className="w-full bg-gray-100 rounded-full h-3"><div className="h-3 rounded-full" style={{ width: `${getProgress(loan)}%`, backgroundColor: getCategoryColor(loan.category) }} /></div></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500">Principal</p><p className="font-semibold">{formatMoney(loan.principal)}</p></div>
                      <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500">Monthly</p><p className="font-semibold">{formatMoney(loan.monthly_payment)}</p></div>
                      <div className="bg-green-50 rounded-lg p-3"><p className="text-green-600">Paid</p><p className="font-semibold text-green-700">{formatMoney(loan.totalPaid)}</p></div>
                      <div className="bg-orange-50 rounded-lg p-3"><p className="text-orange-600">Remaining</p><p className="font-semibold text-orange-700">{formatMoney(getRemaining(loan))}</p></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
        {showAddLoan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-center"><h2 className="text-xl font-semibold">Add New Loan</h2><button onClick={() => setShowAddLoan(false)} className="p-2 hover:bg-gray-100 rounded-lg">X</button></div>
              <form onSubmit={handleAddLoan} className="p-6 space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Loan Name *</label><input type="text" value={newLoan.name} onChange={(e) => setNewLoan({ ...newLoan, name: e.target.value })} placeholder="e.g., Car Loan" className="w-full px-4 py-3 border rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label><select value={newLoan.category} onChange={(e) => setNewLoan({ ...newLoan, category: e.target.value })} className="w-full px-4 py-3 border rounded-lg">{categories.map(cat => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}</select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Principal (₦) *</label><input type="number" value={newLoan.principal} onChange={(e) => setNewLoan({ ...newLoan, principal: e.target.value })} placeholder="500000" className="w-full px-4 py-3 border rounded-lg" required /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label><input type="number" step="0.1" value={newLoan.interest_rate} onChange={(e) => setNewLoan({ ...newLoan, interest_rate: e.target.value })} placeholder="12" className="w-full px-4 py-3 border rounded-lg" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Monthly Payment (₦) *</label><input type="number" value={newLoan.monthly_payment} onChange={(e) => setNewLoan({ ...newLoan, monthly_payment: e.target.value })} placeholder="50000" className="w-full px-4 py-3 border rounded-lg" required /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Tenure (months)</label><input type="number" value={newLoan.tenure} onChange={(e) => setNewLoan({ ...newLoan, tenure: e.target.value })} placeholder="12" className="w-full px-4 py-3 border rounded-lg" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label><input type="date" value={newLoan.start_date} onChange={(e) => setNewLoan({ ...newLoan, start_date: e.target.value })} className="w-full px-4 py-3 border rounded-lg" /></div>
                <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowAddLoan(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Cancel</button><button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Add Loan</button></div>
              </form>
            </div>
          </div>
        )}
        {showPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b"><h3 className="text-xl font-semibold">Record Payment</h3><p className="text-gray-500 mt-1">{showPayment.name}</p></div>
              <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label><input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full px-4 py-3 border rounded-lg text-lg font-semibold" required autoFocus /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label><input type="text" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g., January payment" className="w-full px-4 py-3 border rounded-lg" /></div>
                <div className="flex gap-3 pt-4"><button type="button" onClick={() => { setShowPayment(null); setPaymentAmount(''); setPaymentNote('') }} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Cancel</button><button type="submit" className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">Confirm Payment</button></div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
