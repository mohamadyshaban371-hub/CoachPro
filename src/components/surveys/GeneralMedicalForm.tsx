import React from 'react';
import { ShieldAlert, CircleAlert } from 'lucide-react';
import { GeneralMedicalHistory } from '../../types';

interface GeneralMedicalFormProps {
  medicalData: GeneralMedicalHistory;
  onChange: (data: GeneralMedicalHistory) => void;
  gender: 'male' | 'female';
}

export default function GeneralMedicalForm({ medicalData, onChange, gender }: GeneralMedicalFormProps) {
  const updateField = (field: keyof GeneralMedicalHistory, value: any) => {
    onChange({ ...medicalData, [field]: value });
  };

  return (
    <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2 text-red-400">
        <ShieldAlert size={24} /> التقييم الطبي العام
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Blood Pressure */}
        <div className="space-y-4">
          <p className="text-sm font-bold text-slate-300">هل تعاني من ضغط الدم؟</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => updateField('bloodPressure', true)}
              className={`flex-1 py-3 rounded-xl font-bold border transition-all ${medicalData.bloodPressure ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
            >
              نعم
            </button>
            <button
              type="button"
              onClick={() => updateField('bloodPressure', false)}
              className={`flex-1 py-3 rounded-xl font-bold border transition-all ${!medicalData.bloodPressure ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
            >
              لا
            </button>
          </div>
          {medicalData.bloodPressure && (
            <textarea
              placeholder="يرجى ذكر أي تفاصيل أو أدوية للضغط..."
              className="w-full bg-slate-800 border border-white/5 rounded-xl p-4 h-24 outline-none focus:border-red-500 transition-all resize-none text-white text-sm"
              value={medicalData.bloodPressureDetails || ''}
              onChange={(e) => updateField('bloodPressureDetails', e.target.value)}
            />
          )}
        </div>

        {/* Diabetes */}
        <div className="space-y-4">
          <p className="text-sm font-bold text-slate-300">هل تعاني من مرض السكري؟</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => updateField('diabetes', true)}
              className={`flex-1 py-3 rounded-xl font-bold border transition-all ${medicalData.diabetes ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
            >
              نعم
            </button>
            <button
              type="button"
              onClick={() => updateField('diabetes', false)}
              className={`flex-1 py-3 rounded-xl font-bold border transition-all ${!medicalData.diabetes ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
            >
              لا
            </button>
          </div>
          {medicalData.diabetes && (
            <textarea
              placeholder="يرجى ذكر نوع السكري وأي أدوية مستخدمة..."
              className="w-full bg-slate-800 border border-white/5 rounded-xl p-4 h-24 outline-none focus:border-red-500 transition-all resize-none text-white text-sm"
              value={medicalData.diabetesDetails || ''}
              onChange={(e) => updateField('diabetesDetails', e.target.value)}
            />
          )}
        </div>

        {/* Surgeries */}
        <div className="space-y-4 md:col-span-2">
          <p className="text-sm font-bold text-slate-300">هل أجريت أي عمليات جراحية سابقة؟</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => updateField('surgeries', true)}
              className={`flex-1 py-3 rounded-xl font-bold border transition-all ${medicalData.surgeries ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
            >
              نعم
            </button>
            <button
              type="button"
              onClick={() => updateField('surgeries', false)}
              className={`flex-1 py-3 rounded-xl font-bold border transition-all ${!medicalData.surgeries ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
            >
              لا
            </button>
          </div>
          {medicalData.surgeries && (
            <textarea
              placeholder="يرجى ذكر تفاصيل العمليات الجراحية..."
              className="w-full bg-slate-800 border border-white/5 rounded-xl p-4 h-24 outline-none focus:border-red-500 transition-all resize-none text-white text-sm"
              value={medicalData.surgeryDetails || ''}
              onChange={(e) => updateField('surgeryDetails', e.target.value)}
            />
          )}
        </div>

        {/* Female Specific: Pregnancy / Nursing */}
        {gender === 'female' && (
          <div className="space-y-4 md:col-span-2 animate-in slide-in-from-top duration-300">
            <p className="text-sm font-bold text-pink-400 flex items-center gap-2">
              <CircleAlert size={16} /> هل يوجد حمل أو رضاعة حالياً؟
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => updateField('pregnancyNursing', true)}
                className={`flex-1 py-3 rounded-xl font-bold border transition-all ${medicalData.pregnancyNursing ? 'bg-pink-600 border-pink-500 text-white' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
              >
                نعم
              </button>
              <button
                type="button"
                onClick={() => updateField('pregnancyNursing', false)}
                className={`flex-1 py-3 rounded-xl font-bold border transition-all ${!medicalData.pregnancyNursing ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-transparent text-slate-500 hover:bg-slate-700'}`}
              >
                لا
              </button>
            </div>
          </div>
        )}

        {/* Female Specific: Menstrual Cycle Data */}
        {gender === 'female' && (
          <div className="space-y-4 md:col-span-2 animate-in slide-in-from-top duration-300">
            <p className="text-sm font-bold text-pink-400 flex items-center gap-2">
              <CircleAlert size={16} /> بيانات الدورة الشهرية
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 block">تاريخ آخر دورة شهرية</label>
                <input
                  type="date"
                  className="w-full bg-slate-800 border border-white/5 rounded-xl p-3 outline-none focus:border-pink-500 transition-all text-white text-sm"
                  value={medicalData.lastPeriodStart || ''}
                  onChange={(e) => updateField('lastPeriodStart', e.target.value || undefined)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400 block">طول الدورة (أيام، 21–40)</label>
                <input
                  type="number"
                  min={21}
                  max={40}
                  placeholder="28"
                  className="w-full bg-slate-800 border border-white/5 rounded-xl p-3 outline-none focus:border-pink-500 transition-all text-white text-sm"
                  value={medicalData.cycleLength ?? ''}
                  onChange={(e) => updateField('cycleLength', e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
