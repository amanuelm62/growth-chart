import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Neonate, Measurement, Gender } from './types';
import { calculateCurrentGA, calculateGrowthVelocity, cn } from './lib/utils';
import { calculateGrowthMetrics, generatePercentileLines } from './lib/fentonService';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Scatter
} from 'recharts';
import { 
  Baby, 
  Plus, 
  ChevronRight, 
  Scale, 
  Ruler, 
  CircleDot, 
  User as UserIcon,
  LogOut,
  TrendingUp,
  Trash2,
  ChevronLeft,
  Calendar,
  Settings
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: any) => {
  const variants: any = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100'
  };
  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

const Input = ({ label, error, ...props }: any) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
    <input 
      className={cn(
        "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all",
        error ? "border-red-500" : "border-gray-300"
      )}
      {...props}
    />
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

const Select = ({ label, options, ...props }: any) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
    <select 
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-sans"
      {...props}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [neonates, setNeonates] = useState<Neonate[]>([]);
  const [selectedNeonate, setSelectedNeonate] = useState<Neonate | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showAddNeonate, setShowAddNeonate] = useState(false);
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setNeonates([]);
      return;
    }
    const q = query(
      collection(db, 'neonates'), 
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setNeonates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Neonate)));
    });
  }, [user]);

  useEffect(() => {
    if (!selectedNeonate || !db) {
      setMeasurements([]);
      return;
    }
    const q = query(
      collection(db, `neonates/${selectedNeonate.id}/measurements`), 
      orderBy('date', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      setMeasurements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Measurement)));
    });
  }, [selectedNeonate]);

  const handleLogin = async () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = () => auth && signOut(auth);

  const addNeonate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      gender: formData.get('gender') as Gender,
      dob: formData.get('dob') as string,
      birthGestationalWeeks: parseInt(formData.get('weeks') as string),
      birthGestationalDays: parseInt(formData.get('days') as string),
      mrn: formData.get('mrn') as string,
      ownerId: user?.uid,
      createdAt: Date.now()
    };
    
    try {
      if (!db) return;
      await addDoc(collection(db, 'neonates'), data);
      setShowAddNeonate(false);
    } catch (error) {
      console.error(error);
    }
  };

  const addMeasurement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedNeonate) return;
    
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const weight = parseFloat(formData.get('weight') as string);
    const length = parseFloat(formData.get('length') as string);
    const hc = parseFloat(formData.get('hc') as string);

    // Calculate GA at measurement
    const curGA = calculateCurrentGA(
      selectedNeonate.birthGestationalWeeks,
      selectedNeonate.birthGestationalDays,
      selectedNeonate.dob,
      date
    );

    const gaInWeeks = curGA.weeks + curGA.days / 7;
    
    // Growth metrics
    const metrics = calculateGrowthMetrics(
      selectedNeonate.gender,
      gaInWeeks,
      weight,
      length,
      hc
    );

    // Calculate growth velocity if there's a previous measurement
    let velocity;
    if (measurements.length > 0) {
      const last = measurements[measurements.length - 1];
      const daysDiff = differenceInDays(parseISO(date), parseISO(last.date));
      if (daysDiff > 0) {
        velocity = calculateGrowthVelocity(last.weight, weight, daysDiff) || undefined;
      }
    }

    const data: any = {
      neonateId: selectedNeonate.id,
      date,
      weight,
      length,
      headCircumference: hc,
      gestationalAgeWeeks: curGA.weeks,
      gestationalAgeDays: curGA.days,
      ...metrics,
      createdAt: Date.now()
    };

    if (velocity !== undefined) {
      data.growthVelocity = velocity;
    }

    try {
      if (!db) return;
      // Filter out any other potential undefined values from metrics if any
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );
      await addDoc(collection(db, `neonates/${selectedNeonate.id}/measurements`), cleanedData);
      setShowAddMeasurement(false);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteNeonate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this neonate and all measurements?')) return;
    try {
      if (!db) return;
      await deleteDoc(doc(db, 'neonates', id));
      setSelectedNeonate(null);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user || !db) {
    return (
      <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-indigo-100 flex flex-col items-center">
          <div className="bg-indigo-100 p-4 rounded-full mb-6">
            <Baby className="w-12 h-12 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">NICU Tracker</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Monitor neonatal growth with precision. Track anthropometry and plot Fenton 2013 growth curves.
          </p>
          {!user ? (
            <Button onClick={handleLogin} className="w-full py-3 text-lg">
              <UserIcon className="w-5 h-5" />
              Sign in with Google
            </Button>
          ) : (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-sm">
              <Settings className="w-5 h-5 mx-auto mb-2 animate-spin" />
              <p className="font-bold mb-1">Configuration Pending</p>
              Please accept the Firebase terms in the popup to complete the setup.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row font-sans">
      {/* Sidebar - Neonate List */}
      <aside className={cn(
        "w-full lg:w-80 bg-white border-r border-gray-200 lg:flex-shrink-0 flex flex-col",
        selectedNeonate ? "hidden lg:flex" : "flex"
      )}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm">
              <Baby className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 tracking-tight">NICU Tracker</span>
          </div>
          <Button onClick={handleLogout} variant="ghost" className="p-2 h-auto rounded-full">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 flex-grow overflow-auto space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Neonates</h2>
            <Button 
              variant="secondary" 
              className="p-1 px-2 h-auto text-xs"
              onClick={() => setShowAddNeonate(true)}
            >
              <Plus className="w-3 h-3" />
              New
            </Button>
          </div>

          <div className="space-y-1">
            {neonates.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Baby className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No neonates added yet.</p>
              </div>
            ) : (
              neonates.map(n => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNeonate(n)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group",
                    selectedNeonate?.id === n.id 
                      ? "bg-indigo-50 border border-indigo-100" 
                      : "hover:bg-gray-50 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm",
                      n.gender === Gender.MALE ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                    )}>
                      {n.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 leading-none mb-1">{n.name}</div>
                      <div className="text-xs text-gray-500">{n.birthGestationalWeeks}w {n.birthGestationalDays}d • MRN: {n.mrn || 'N/A'}</div>
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 text-gray-300 transition-transform group-hover:translate-x-1",
                    selectedNeonate?.id === n.id && "text-indigo-600"
                  )} />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 mt-auto bg-gray-50/50">
          <div className="flex items-center gap-3">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              alt={user.displayName || ''} 
              className="w-8 h-8 rounded-full shadow-sm"
            />
            <div className="flex-grow overflow-hidden">
              <div className="text-xs font-semibold text-gray-900 truncate">{user.displayName}</div>
              <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
            </div>
            <Settings className="w-4 h-4 text-gray-400 cursor-pointer" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-grow flex flex-col min-w-0 transition-all bg-white overflow-y-auto",
        !selectedNeonate && "hidden lg:flex"
      )}>
        {selectedNeonate ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <header className="p-4 lg:p-6 border-b border-gray-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  className="lg:hidden p-2 -ml-2" 
                  onClick={() => setSelectedNeonate(null)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner",
                  selectedNeonate.gender === Gender.MALE ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
                )}>
                  <Baby className="w-6 h-6" />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{selectedNeonate.name}</h1>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      selectedNeonate.gender === Gender.MALE ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"
                    )}>
                      {selectedNeonate.gender}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    Born {format(parseISO(selectedNeonate.dob), 'MMM d, yyyy')} • {selectedNeonate.birthGestationalWeeks}w {selectedNeonate.birthGestationalDays}d GA
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => setShowAddMeasurement(true)}
                    className="shadow-md shadow-indigo-100"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add Measurement</span>
                  </Button>
                  <Button 
                    variant="danger" 
                    className="p-2 rounded-lg"
                    onClick={() => deleteNeonate(selectedNeonate.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </header>

            {/* Growth Stats Recap */}
            {measurements.length > 0 && (
              <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100 border-b border-gray-100">
                <StatCard 
                  label="Current Weight" 
                  value={`${(measurements[measurements.length - 1].weight / 1000).toFixed(3)} kg`}
                  percentile={measurements[measurements.length - 1].weightPercentile}
                  icon={<Scale className="w-4 h-4 text-blue-600" />}
                />
                <StatCard 
                  label="Current Length" 
                  value={`${measurements[measurements.length - 1].length} cm`}
                  percentile={measurements[measurements.length - 1].lengthPercentile}
                  icon={<Ruler className="w-4 h-4 text-emerald-600" />}
                />
                <StatCard 
                  label="Head Circ." 
                  value={`${measurements[measurements.length - 1].headCircumference} cm`}
                  percentile={measurements[measurements.length - 1].hcPercentile}
                  icon={<CircleDot className="w-4 h-4 text-indigo-600" />}
                />
                <StatCard 
                  label="Growth Velocity" 
                  value={measurements[measurements.length - 1].growthVelocity ? `${measurements[measurements.length - 1].growthVelocity?.toFixed(1)} g/kg/d` : '--'}
                  trend={measurements[measurements.length - 1].growthVelocity}
                  icon={<TrendingUp className="w-4 h-4 text-amber-600" />}
                />
              </section>
            )}

            {/* Charts View */}
            <div className="p-4 lg:p-6 space-y-8 bg-gray-50 overflow-y-auto">
              <ChartSection 
                title="Weight for Gestational Age"
                unit="kg"
                data={measurements.map(m => ({ gestationalAge: m.gestationalAgeWeeks + m.gestationalAgeDays/7, value: m.weight / 1000 }))}
                percentiles={generatePercentileLines(selectedNeonate.gender, 'weight')}
                domain={[22, 50]}
                yDomain={[0, 6]}
              />
              <div className="grid md:grid-cols-2 gap-6">
                <ChartSection 
                  title="Length for GA"
                  unit="cm"
                  data={measurements.map(m => ({ gestationalAge: m.gestationalAgeWeeks + m.gestationalAgeDays/7, value: m.length }))}
                  percentiles={generatePercentileLines(selectedNeonate.gender, 'length')}
                  domain={[22, 50]}
                  yDomain={[15, 60]}
                />
                <ChartSection 
                  title="Head Circ. for GA"
                  unit="cm"
                  data={measurements.map(m => ({ gestationalAge: m.gestationalAgeWeeks + m.gestationalAgeDays/7, value: m.headCircumference }))}
                  percentiles={generatePercentileLines(selectedNeonate.gender, 'hc')}
                  domain={[22, 50]}
                  yDomain={[15, 45]}
                />
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-gray-900">Measurement History</h3>
                  <div className="text-xs text-gray-400">Total: {measurements.length} entries</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-medium">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">GA</th>
                        <th className="px-4 py-3">Weight (g)</th>
                        <th className="px-4 py-3">Length (cm)</th>
                        <th className="px-4 py-3">HC (cm)</th>
                        <th className="px-4 py-3">Velocity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {measurements.slice().reverse().map(m => (
                        <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{format(parseISO(m.date), 'MMM d, yyyy')}</div>
                            <div className="text-[10px] text-gray-400">Recorded by you</div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {m.gestationalAgeWeeks}w {m.gestationalAgeDays}d
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{m.weight}g</span>
                              <div className="flex gap-2 items-center">
                                <span className="text-[10px] text-indigo-600 font-semibold">{m.weightPercentile?.toFixed(1)}%</span>
                                <span className="text-[10px] text-gray-400">Z: {m.weightZScore?.toFixed(2)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{m.length}cm</span>
                              <div className="flex gap-2 items-center">
                                <span className="text-[10px] text-emerald-600 font-semibold">{m.lengthPercentile?.toFixed(1)}%</span>
                                <span className="text-[10px] text-gray-400">Z: {m.lengthZScore?.toFixed(2)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{m.headCircumference}cm</span>
                              <div className="flex gap-2 items-center">
                                <span className="text-[10px] text-blue-600 font-semibold">{m.hcPercentile?.toFixed(1)}%</span>
                                <span className="text-[10px] text-gray-400">Z: {m.hcZScore?.toFixed(2)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                            {m.growthVelocity ? (
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-indigo-600">{m.growthVelocity.toFixed(1)}</span>
                                <span className="text-[10px] text-gray-400 uppercase tracking-tighter">g/kg/d</span>
                              </div>
                            ) : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-grow flex items-center justify-center p-12 text-center bg-gray-50">
            <div className="max-w-sm">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
                <Baby className="w-16 h-16 text-indigo-200 mb-6" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Select a Neonate</h2>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  Choose a patient from the list or add a new one to begin tracking growth and plotting Fenton curves.
                </p>
                <Button onClick={() => setShowAddNeonate(true)}>
                  <Plus className="w-4 h-4" />
                  Register New Patient
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showAddNeonate && (
          <Modal title="Register New Neonate" onClose={() => setShowAddNeonate(false)}>
            <form onSubmit={addNeonate} className="space-y-4">
              <Input label="Patient Full Name" name="name" placeholder="Enter name" required />
              <div className="grid grid-cols-2 gap-4">
                <Select 
                  label="Gender" 
                  name="gender" 
                  options={[{label: 'Male', value: 'male'}, {label: 'Female', value: 'female'}]} 
                />
                <Input label="Medical Record #" name="mrn" placeholder="Optional" />
              </div>
              <Input label="Date of Birth" name="dob" type="date" required defaultValue={format(new Date(), 'yyyy-MM-dd')} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Birth GA Weeks" name="weeks" type="number" min="22" max="50" required placeholder="e.g. 28" />
                <Input label="Birth GA Days" name="days" type="number" min="0" max="6" required placeholder="0-6" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="secondary" type="button" onClick={() => setShowAddNeonate(false)}>Cancel</Button>
                <Button type="submit">Complete Registration</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddMeasurement && (
          <Modal title={`Add Measurement: ${selectedNeonate?.name}`} onClose={() => setShowAddMeasurement(false)}>
            <form onSubmit={addMeasurement} className="space-y-4">
              <Input label="Measurement Date" name="date" type="date" required defaultValue={format(new Date(), 'yyyy-MM-dd')} />
              <div className="grid grid-cols-3 gap-4">
                <Input label="Weight (g)" name="weight" type="number" step="1" required placeholder="e.g. 850" />
                <Input label="Length (cm)" name="length" type="number" step="0.1" required placeholder="e.g. 32.5" />
                <Input label="HC (cm)" name="hc" type="number" step="0.1" required placeholder="e.g. 24.0" />
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800">
                  GA, Z-scores, percentiles and growth velocity (if applicable) will be calculated automatically based on the Fenton 2013 standard.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="secondary" type="button" onClick={() => setShowAddMeasurement(false)}>Cancel</Button>
                <Button type="submit">Save Assessment</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Helper Components ---

function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold font-sans tracking-tight text-gray-900">{title}</h2>
          <Button variant="ghost" onClick={onClose} className="p-2 h-auto text-gray-400 hover:rotate-90 transition-transform">
            <Plus className="w-5 h-5 rotate-45" />
          </Button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, percentile, trend, icon }: any) {
  return (
    <div className="bg-white p-4 flex flex-col gap-1 transition-all hover:bg-gray-50 group">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-gray-50 group-hover:bg-white border border-transparent group-hover:border-gray-100 transition-all shadow-sm">
          {icon}
        </div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-sans text-gray-900 tabular-nums">{value}</span>
      </div>
      {(percentile !== undefined || trend !== undefined) && (
        <div className="flex items-center gap-1.5">
          {percentile !== undefined && (
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 rounded-full py-0.5">
              {percentile.toFixed(0)}th ptile
            </span>
          )}
          {trend !== undefined && trend > 15 && (
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" /> High
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ChartSection({ title, unit, data, percentiles, domain, yDomain }: any) {
  // To ensure Recharts plots everything correctly, we can use the main data prop
  // or ensure each Line has its own data. 
  // IMPORTANT: Recharts needs the X-axis key (gestationalAge) to be present in ALL data objects.
  
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
          {title}
          <span className="text-xs font-normal text-gray-400">({unit})</span>
        </h3>
        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
          <div className="flex items-center gap-1"><div className="w-2 h-0.5 bg-gray-300"></div> 3/10/90/97</div>
          <div className="flex items-center gap-1"><div className="w-2 h-0.5 bg-gray-600"></div> 50th</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-600 shadow-sm"></div> Patient</div>
        </div>
      </div>
      <div className="h-80 w-full select-none">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 10, right: 30, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#f1f5f9" />
            <XAxis 
              dataKey="gestationalAge" 
              type="number" 
              domain={domain} 
              allowDecimals={true}
              ticks={[22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50]}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={{ stroke: '#e2e8f0' }}
              label={{ value: 'Gestational Age (weeks)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#64748b', fontWeight: 500 }}
            />
            <YAxis 
              type="number" 
              domain={yDomain} 
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={{ stroke: '#e2e8f0' }}
              orientation="right"
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', padding: '12px' }}
              labelFormatter={(ga) => `GA: ${Number(ga).toFixed(1)} weeks`}
              formatter={(value: any) => [Number(value).toFixed(2), unit]}
            />
            
            {/* Percentile Lines */}
            <Line data={percentiles} type="monotone" dataKey="p3" stroke="#e2e8f0" strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />
            <Line data={percentiles} type="monotone" dataKey="p10" stroke="#cbd5e1" strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />
            <Line data={percentiles} type="monotone" dataKey="p50" stroke="#94a3b8" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
            <Line data={percentiles} type="monotone" dataKey="p90" stroke="#cbd5e1" strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />
            <Line data={percentiles} type="monotone" dataKey="p97" stroke="#e2e8f0" strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />

            {/* Actual Measurements */}
            {data && data.length > 0 && (
              <Line 
                data={data} 
                type="linear" 
                dataKey="value" 
                stroke="#4338ca" 
                strokeWidth={3} 
                dot={{ fill: '#4338ca', r: 5, strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 7, strokeWidth: 0, fill: '#4338ca' }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
