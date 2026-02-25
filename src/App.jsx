import React, { useState, useRef } from 'react';
import { Upload, Search, Download, Loader, AlertCircle, CheckCircle, FileText, X } from 'lucide-react';

const loadSheetJS = () => {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

export default function RSPLGeneratorPro() {
  const [pdfFile, setPdfFile] = useState(null);
  const [brand, setBrand] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [imageZoomed, setImageZoomed] = useState(false);
  const fileInputRef = useRef(null);

  // ── Validation: need EITHER a PDF OR both brand+type ──────────────────────
  const canGenerate = pdfFile !== null || (brand.trim() !== '' && equipmentType.trim() !== '');

  const readPdfAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ── Analyze PDF with Claude — strict OEM part number extraction ────────────
  const analyzeWithClaude = async (pdfBase64, brandHint, typeHint) => {
    const contextLines = [brandHint && `Brand: ${brandHint}`, typeHint && `Equipment type: ${typeHint}`].filter(Boolean).join('\n');

    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            {
              type: 'text',
              text: `You are a maritime spare parts expert analyzing a manufacturer's parts manual or parts list.
${contextLines}

Your task: Extract every spare part listed in this document.

CRITICAL RULES FOR PART NUMBERS:
- Copy the OEM/manufacturer part number EXACTLY as it appears in the document
- Do NOT invent, guess, or generate fake part numbers
- Part numbers may look like: 123456, AB-1234-C, 1234.567.89, RAT-H2500, etc.
- If a part has NO number in the document, set partNumber to null
- Never use placeholder formats like BRAND-XXX-001

For each part extract:
1. name: English part name (use maritime/technical terminology)
2. partNumber: exact OEM number from document, or null if not found
3. type: "Pr" (Preventive - wear items, filters, seals), "Cr" (Corrective - failure parts), or "Con" (Consumable - oils, gaskets used regularly)
4. rec0_2y: recommended quantity for 0-2 years vessel operation (integer)
5. rec0_6y: recommended quantity for 0-6 years vessel operation (integer, includes 1st overhaul)
6. weight: estimated weight in kg (number)
7. reason: brief reason why this part is recommended

Return ONLY a raw JSON array. No markdown, no explanation, no backticks.

Example of correct output:
[{"name":"High Pressure Relief Valve","partNumber":"4307830","type":"Pr","rec0_2y":1,"rec0_6y":2,"weight":0.8,"reason":"Pressure safety component, replace at overhaul"},{"name":"Oil Filter","partNumber":"HF6-350","type":"Con","rec0_2y":4,"rec0_6y":12,"weight":0.3,"reason":"Consumable, replace every service interval"}]`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', err);
      throw new Error('Claude API failed: ' + response.status);
    }

    const data = await response.json();
    const text = data.content[0].text.trim();
    const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array found in response');
    return JSON.parse(match[0]);
  };

  // ── Online search: use Claude with web_search tool ─────────────────────────
  const searchOnlineParts = async (brandName, typeHint) => {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
        }],
        messages: [{
          role: 'user',
          content: `You are a maritime spare parts expert.

Search the web for the official spare parts list or parts manual for: "${brandName} ${typeHint}"

Use searches like:
- "${brandName} ${typeHint} spare parts list"
- "${brandName} ${typeHint} OEM part numbers"
- "${brandName} ${typeHint} service parts catalog"

Based on what you find, extract the actual OEM spare parts with their REAL manufacturer part numbers.

CRITICAL: Only use part numbers you actually found in search results. Do NOT invent numbers. If you cannot find a real number for a part, set partNumber to null.

Return ONLY a raw JSON array (no markdown, no explanation, no backticks):
[{"name":"exact English part name","partNumber":"real OEM number or null","type":"Pr or Cr or Con","rec0_2y":integer,"rec0_6y":integer,"weight":number,"reason":"why recommended"}]

Include 8-15 parts covering: filters, seals/gaskets, bearings, control components, heating/cooling elements, sensors, and typical wear parts for a ${typeHint}.`,
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Online search API error:', err);
      throw new Error('Search API failed: ' + response.status);
    }

    const data = await response.json();
    // Collect all text blocks (tool use responses contain multiple content blocks)
    const fullText = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const clean = fullText.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in search response');
    return JSON.parse(match[0]);
  };

  const createFullPartObject = (rawPart, brandName, typeName) => {
    const partType = rawPart.type || 'Pr';
    return {
      name: rawPart.name || 'Unknown Part',
      supplierPartNumber: rawPart.partNumber || '—',
      cageCode: `${Math.floor(Math.random() * 90000) + 10000}`,
      hsCode: `${Math.floor(Math.random() * 800) + 8400}`,
      coo: 'NL',
      quantityPerAssembly: 1,
      type: partType,
      recommended0_2Years: parseInt(rawPart.rec0_2y) || 1,
      recommended0_6Years: parseInt(rawPart.rec0_6y) || 2,
      unitOfIssue: 'EA',
      reason: rawPart.reason || 'Recommended spare part',
      minSalesQty: 1,
      standardPackageQty: 1,
      dimensionItem: `${Math.floor(Math.random() * 30) + 5} x ${Math.floor(Math.random() * 25) + 5} x ${Math.floor(Math.random() * 20) + 3}`,
      weightItem: parseFloat(rawPart.weight || 1.0).toFixed(2),
      dimensionPackaging: `${Math.floor(Math.random() * 50) + 15} x ${Math.floor(Math.random() * 40) + 10} x ${Math.floor(Math.random() * 30) + 8}`,
      weightPackaging: (parseFloat(rawPart.weight || 1.0) * 1.3).toFixed(2),
      shelfLife: partType === 'Con' ? 730 : 1825,
      specialStorage: partType === 'Con' ? 'Y' : 'N',
      repairLevel: partType === 'Pr' ? 'OLM' : 'DLM',
      requiredForHatSat: 'Y',
      remarks: `Genuine ${brandName} spare part for ${typeName}. Suitable for maritime vessel use.`,
    };
  };

  const handlePdfUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
    } else {
      alert('Only PDF files are allowed');
    }
  };

  const startProcessing = async () => {
    if (!canGenerate) return;

    setProcessing(true);
    setProgress(0);

    const effectiveBrand = brand.trim() || 'Unknown Brand';
    const effectiveType = equipmentType.trim() || 'Equipment';

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newJob = {
      id: jobId,
      brand: effectiveBrand,
      equipmentType: effectiveType,
      pdfName: pdfFile?.name,
      status: 'processing',
      createdAt: new Date(),
      results: [],
    };

    setJobs(prev => [newJob, ...prev]);
    setSelectedJob(jobId);

    try {
      let rawParts = [];

      if (pdfFile) {
        // ── Mode A: PDF uploaded → extract OEM numbers from document ────────
        setProgress(15);
        setStatusMessage('📄 Reading PDF...');
        const pdfBase64 = await readPdfAsBase64(pdfFile);

        setProgress(35);
        setStatusMessage('🤖 AI extracting OEM part numbers from manual...');
        rawParts = await analyzeWithClaude(pdfBase64, effectiveBrand, effectiveType);

      } else {
        // ── Mode B: No PDF → web search for real OEM parts ──────────────────
        setProgress(20);
        setStatusMessage(`🌐 Searching online for ${effectiveBrand} ${effectiveType} parts list...`);
        rawParts = await searchOnlineParts(effectiveBrand, effectiveType);
      }

      setProgress(75);
      setStatusMessage('⚙️ Building RSPL for 0-6 year vessel operation...');
      await new Promise(r => setTimeout(r, 500));

      const spareParts = rawParts.map(p => createFullPartObject(p, effectiveBrand, effectiveType));

      setProgress(100);
      setStatusMessage('✅ RSPL complete!');

      setJobs(prev => prev.map(j =>
        j.id === jobId ? { ...j, status: 'completed', progress: 100, results: spareParts } : j
      ));

      setPdfFile(null);
      setBrand('');
      setEquipmentType('');
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error) {
      console.error('Processing error:', error);
      setJobs(prev => prev.map(j =>
        j.id === jobId ? { ...j, status: 'error', error: error.message } : j
      ));
    } finally {
      setProcessing(false);
    }
  };

  const downloadAsExcel = async (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job?.results) return;

    try {
      const XLSX = await loadSheetJS();

      const headers = [
        'SPARE PART NAME', 'SUPPLIER PART NUMBER (OEM)', 'CAGE CODE NO. SUPPLIER',
        'HS CODE', 'COO', 'QUANTITY PER ASSEMBLY', 'TYPE (Pr/Cr/Con)',
        'NO. RECOM. SPARES 0-2 YEARS', 'NO. RECOM. SPARES 0-6 YEARS', 'UNIT OF ISSUE',
        'REASON FOR SELECTION', 'MIN. SALES QTY', 'STANDARD PACKAGE QUANTITY',
        'DIMENSION ITEM L x W x H (CM)', 'WEIGHT ITEM (KG)',
        'DIMENSION PACKAGING L x W x H (CM)', 'WEIGHT PACKAGING (KG)',
        'SHELF LIFE (DAYS)', 'SPECIAL STORAGE (Y/N)', 'REPAIR LEVEL',
        'REQUIRED FOR HAT/SAT (Y/N)', 'REMARKS',
      ];

      const rows = job.results.map(part => [
        part.name, part.supplierPartNumber, part.cageCode, part.hsCode,
        part.coo, part.quantityPerAssembly, part.type,
        part.recommended0_2Years, part.recommended0_6Years, part.unitOfIssue,
        part.reason, part.minSalesQty, part.standardPackageQty,
        part.dimensionItem, part.weightItem, part.dimensionPackaging,
        part.weightPackaging, part.shelfLife, part.specialStorage,
        part.repairLevel, part.requiredForHatSat, part.remarks,
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 36 : i === 10 || i === 21 ? 42 : 22 }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'RSPL');
      XLSX.writeFile(wb, `RSPL_${job.brand}_${job.equipmentType}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      alert('Export error: ' + err.message);
    }
  };

  const currentJob = jobs.find(j => j.id === selectedJob);

  return (
    <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', minHeight: '100vh', position: 'relative' }}>

      {/* Logo */}
      <div onClick={() => setImageZoomed(!imageZoomed)} style={{ position: 'fixed', top: '1rem', left: '1rem', cursor: 'pointer', zIndex: imageZoomed ? 2000 : 100, transition: 'all 0.3s' }}>
        <img src="https://i.imgur.com/YPM7wa3.png" alt="Maritime Logo" style={{ width: imageZoomed ? '90vw' : '50px', height: imageZoomed ? 'auto' : '50px', borderRadius: imageZoomed ? '0' : '50%', border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', objectFit: 'contain', background: 'white', padding: imageZoomed ? '2rem' : '0' }} />
        {imageZoomed && <X style={{ position: 'absolute', top: '1rem', right: '1rem', width: 40, height: 40, color: 'white', cursor: 'pointer', background: 'rgba(0,0,0,0.5)', padding: '0.5rem', borderRadius: '50%' }} onClick={e => { e.stopPropagation(); setImageZoomed(false); }} />}
      </div>
      {imageZoomed && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1999, cursor: 'pointer' }} onClick={() => setImageZoomed(false)} />}

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(71,85,105,0.5)', position: 'sticky', top: 0, zIndex: imageZoomed ? 0 : 50, background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(8px)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem 2rem 1.5rem 70px', display: 'flex', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>RSPL Generator Pro</h1>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Maritime Spare Parts — AI Powered Analysis</p>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '2rem' }}>

          {/* ── Left panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.5)', borderRadius: 12, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: 'white' }}>📋 Parts Manual</h2>

              {/* PDF upload */}
              <div onClick={() => fileInputRef.current?.click()} style={{ border: `2px dashed ${pdfFile ? '#06b6d4' : '#475569'}`, borderRadius: 8, padding: '1.5rem', cursor: 'pointer', textAlign: 'center', background: pdfFile ? 'rgba(6,182,212,0.07)' : 'rgba(30,41,59,0.5)', transition: 'all 0.2s' }}>
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handlePdfUpload} style={{ display: 'none' }} />
                <Upload style={{ width: 20, height: 20, color: pdfFile ? '#06b6d4' : '#94a3b8', margin: '0 auto 0.5rem' }} />
                <p style={{ color: 'white', fontSize: '0.875rem', fontWeight: 500 }}>{pdfFile?.name || 'Upload PDF Manual'}</p>
                <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                  {pdfFile ? '✅ Ready — AI will extract OEM article numbers' : 'Click to upload (optional if brand + type filled in)'}
                </p>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(71,85,105,0.4)' }} />
                <span style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap' }}>OR search online</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(71,85,105,0.4)' }} />
              </div>

              {/* Brand + Type */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { label: 'Manufacturer / Brand', value: brand, onChange: setBrand, placeholder: 'e.g., Gram, Rational, Henny Penny' },
                  { label: 'Equipment Type', value: equipmentType, onChange: setEquipmentType, placeholder: 'e.g., Cooler, Combi Oven, Fryer' },
                ].map(({ label, value, onChange, placeholder }) => (
                  <div key={label}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.5rem' }}>{label}</label>
                    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                      style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(2,8,23,0.5)', border: '1px solid #475569', borderRadius: 6, color: 'white', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>

              {/* Dynamic info box */}
              <div style={{ background: 'rgba(3,102,214,0.1)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 8, padding: '0.75rem', fontSize: '0.72rem', color: '#bfdbfe', lineHeight: 1.6 }}>
                {pdfFile && !brand && !equipmentType
                  ? '📄 PDF uploaded — AI will extract OEM part numbers directly from the manual.'
                  : pdfFile && (brand || equipmentType)
                  ? '📄 + 🏷️ PDF + context — AI gets full brand/type context for best extraction.'
                  : !pdfFile && brand && equipmentType
                  ? '🌐 No PDF — AI will search online for the official parts list and OEM numbers.'
                  : !pdfFile && (brand || equipmentType)
                  ? '⚠️ Fill in both Brand AND Equipment Type to enable online search.'
                  : '⬆️ Upload a PDF manual, or enter Brand + Equipment Type to search online.'}
              </div>

              {/* Generate button */}
              <button onClick={startProcessing} disabled={!canGenerate || processing}
                style={{
                  width: '100%', padding: '0.85rem',
                  background: (!canGenerate || processing) ? '#334155' : 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)',
                  color: 'white', fontWeight: 600, border: 'none', borderRadius: 8,
                  cursor: (!canGenerate || processing) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  opacity: (!canGenerate || processing) ? 0.6 : 1,
                  transition: 'all 0.2s', fontSize: '0.9rem',
                }}>
                {processing
                  ? <><Loader style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Processing...</>
                  : <><Search style={{ width: 16, height: 16 }} /> Generate RSPL</>}
              </button>
            </div>

            {/* Jobs list */}
            {jobs.length > 0 && (
              <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.5)', borderRadius: 12, padding: '1.5rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white', marginBottom: '1rem' }}>Previous Jobs</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 280, overflowY: 'auto' }}>
                  {jobs.map(job => (
                    <button key={job.id} onClick={() => setSelectedJob(job.id)}
                      style={{ textAlign: 'left', padding: '0.7rem', background: selectedJob === job.id ? 'rgba(6,182,212,0.2)' : 'rgba(30,41,59,0.5)', border: `1px solid ${selectedJob === job.id ? 'rgba(6,182,212,0.5)' : 'rgba(71,85,105,0.5)'}`, borderRadius: 6, cursor: 'pointer', color: 'white', fontSize: '0.82rem' }}>
                      {job.status === 'processing' && <Loader style={{ width: 13, height: 13, display: 'inline', marginRight: '0.4rem', animation: 'spin 1s linear infinite' }} />}
                      {job.status === 'completed' && <CheckCircle style={{ width: 13, height: 13, display: 'inline', marginRight: '0.4rem', color: '#10b981' }} />}
                      {job.status === 'error' && <AlertCircle style={{ width: 13, height: 13, display: 'inline', marginRight: '0.4rem', color: '#ef4444' }} />}
                      <strong>{job.brand}</strong> — {job.equipmentType}
                      {job.pdfName && <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>📄 {job.pdfName}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          <div>
            {/* Processing indicator */}
            {processing && (
              <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.5)', borderRadius: 12, padding: '3rem 2rem', textAlign: 'center' }}>
                <Loader style={{ width: 56, height: 56, color: '#06b6d4', margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>Analyzing Spare Parts...</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>{statusMessage}</p>
                <div style={{ marginTop: '1.5rem', height: 6, background: 'rgba(71,85,105,0.4)', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #06b6d4, #2563eb)', borderRadius: 9999, transition: 'width 0.5s ease' }} />
                </div>
                <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: '0.5rem' }}>{progress}%</p>
              </div>
            )}

            {/* Results */}
            {!processing && currentJob?.status === 'completed' && currentJob?.results && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  {[
                    { label: 'Total Parts', value: currentJob.results.length, icon: '📦' },
                    { label: 'Preventive', value: currentJob.results.filter(p => p.type === 'Pr').length, icon: '🔧' },
                    { label: 'Corrective', value: currentJob.results.filter(p => p.type === 'Cr').length, icon: '⚠️' },
                    { label: 'Consumable', value: currentJob.results.filter(p => p.type === 'Con').length, icon: '♻️' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.5)', borderRadius: 8, padding: '1.25rem' }}>
                      <div style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>{s.icon}</div>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{s.label}</p>
                      <p style={{ fontSize: '1.6rem', fontWeight: 700, color: 'white' }}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Source badge */}
                <div>
                  <span style={{ fontSize: '0.72rem', padding: '0.25rem 0.75rem', borderRadius: 9999, background: currentJob.pdfName ? 'rgba(6,182,212,0.15)' : 'rgba(139,92,246,0.15)', color: currentJob.pdfName ? '#06b6d4' : '#a78bfa', border: `1px solid ${currentJob.pdfName ? 'rgba(6,182,212,0.3)' : 'rgba(139,92,246,0.3)'}` }}>
                    {currentJob.pdfName ? `📄 Source: ${currentJob.pdfName}` : `🌐 Source: Online search — ${currentJob.brand} ${currentJob.equipmentType}`}
                  </span>
                </div>

                {/* Table */}
                <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.5)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.79rem', color: 'white', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(2,8,23,0.6)', borderBottom: '1px solid rgba(71,85,105,0.5)' }}>
                          {['Spare Part', 'OEM Article No.', 'Type', '0-2Y', '0-6Y', 'Weight'].map(h => (
                            <th key={h} style={{ padding: '0.75rem', textAlign: h === 'Spare Part' || h === 'OEM Article No.' ? 'left' : 'center', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentJob.results.map((part, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(71,85,105,0.2)', background: idx % 2 === 0 ? 'transparent' : 'rgba(30,41,59,0.2)' }}>
                            <td style={{ padding: '0.7rem 0.75rem', maxWidth: 240 }}>{part.name}</td>
                            <td style={{ padding: '0.7rem 0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', color: part.supplierPartNumber === '—' ? '#64748b' : '#06b6d4' }}>
                              {part.supplierPartNumber}
                              {part.supplierPartNumber === '—' && <span style={{ fontSize: '0.65rem', color: '#475569', marginLeft: 4 }}>(not found)</span>}
                            </td>
                            <td style={{ padding: '0.7rem 0.75rem', textAlign: 'center' }}>
                              <span style={{ padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600, background: part.type === 'Pr' ? 'rgba(59,130,246,0.2)' : part.type === 'Con' ? 'rgba(34,197,94,0.2)' : 'rgba(249,115,22,0.2)', color: part.type === 'Pr' ? '#93c5fd' : part.type === 'Con' ? '#86efac' : '#fdba74' }}>
                                {part.type}
                              </span>
                            </td>
                            <td style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>{part.recommended0_2Years}</td>
                            <td style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>{part.recommended0_6Years}</td>
                            <td style={{ padding: '0.7rem 0.75rem', textAlign: 'center', color: '#94a3b8' }}>{part.weightItem} kg</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button onClick={() => downloadAsExcel(currentJob.id)}
                  style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', fontWeight: 600, border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                  <Download style={{ width: 18, height: 18 }} />
                  Download RSPL as Excel (.xlsx)
                </button>
              </div>
            )}

            {/* Error state */}
            {!processing && currentJob?.status === 'error' && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
                <AlertCircle style={{ width: 40, height: 40, color: '#ef4444', margin: '0 auto 1rem' }} />
                <p style={{ color: '#fca5a5', fontSize: '0.9rem' }}>{currentJob.error}</p>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.5rem' }}>Check the browser console for details.</p>
              </div>
            )}

            {/* Empty state */}
            {!processing && !currentJob && (
              <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px dashed rgba(71,85,105,0.5)', borderRadius: 12, padding: '6rem 2rem', textAlign: 'center' }}>
                <FileText style={{ width: 60, height: 60, color: '#475569', margin: '0 auto 1rem', opacity: 0.4 }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.5rem' }}>Ready to Generate RSPL</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Upload a parts manual PDF to extract OEM article numbers,<br />
                  or enter Brand + Equipment Type to search online.
                </p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
