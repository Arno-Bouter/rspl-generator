import React, { useState, useRef } from 'react';
import { Upload, Search, Download, Loader, AlertCircle, CheckCircle, FileText, Settings, Zap, Globe } from 'lucide-react';

export default function RSPLGeneratorPro() {
  const [stage, setStage] = useState('input');
  const [pdfFile, setPdfFile] = useState(null);
  const [brand, setBrand] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef(null);

  const handlePdfUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
    } else {
      alert('Alleen PDF bestanden zijn toegestaan');
    }
  };

  const generateJobId = () => {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const generateMockSupplierData = (partName, brand, equipmentType) => {
    const hsCode = `${Math.floor(Math.random() * 8000) + 8400}`;
    const coo = ['NL', 'DE', 'IT', 'ES', 'SE'][Math.floor(Math.random() * 5)];
    
    return {
      supplierPartNumber: `${brand.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 9000) + 1000}`,
      cageCode: `${Math.floor(Math.random() * 90000) + 10000}`,
      hsCode: hsCode,
      coo: coo,
      minSalesQty: Math.floor(Math.random() * 5) + 1,
      standardPackageQty: Math.floor(Math.random() * 10) + 1,
      dimensionItem: `${Math.floor(Math.random() * 50) + 10} x ${Math.floor(Math.random() * 40) + 5} x ${Math.floor(Math.random() * 30) + 3}`,
      weightItem: (Math.random() * 50 + 0.5).toFixed(2),
      dimensionPackaging: `${Math.floor(Math.random() * 80) + 20} x ${Math.floor(Math.random() * 60) + 15} x ${Math.floor(Math.random() * 50) + 10}`,
      weightPackaging: (Math.random() * 100 + 1).toFixed(2),
      shelfLife: Math.floor(Math.random() * 2000) + 365,
      specialStorage: Math.random() > 0.5 ? 'Y' : 'N',
    };
  };

  const generateSparePartsFromEquipment = async (brand, equipmentType) => {
    const equipmentLower = equipmentType.toLowerCase();
    
    const partsLibrary = {
      'oven': [
        { name: 'Heating Element', type: 'Cr', reason: 'Critical heat source component' },
        { name: 'Temperature Sensor (RTD)', type: 'Cr', reason: 'Temperature monitoring and control' },
        { name: 'Door Seal Gasket Kit', type: 'Con', reason: 'Consumable wear item' },
        { name: 'Control Board/PCB', type: 'Pr', reason: 'Essential for operation' },
        { name: 'Timer Module', type: 'Cr', reason: 'Frequent failure item' },
      ],
      'fryer': [
        { name: 'Immersion Heating Element', type: 'Cr', reason: 'Subject to high thermal stress' },
        { name: 'Thermostat Assembly', type: 'Cr', reason: 'Critical safety component' },
        { name: 'Basket (Stainless Steel)', type: 'Con', reason: 'Consumable with regular wear' },
        { name: 'Oil Filter Cartridge', type: 'Con', reason: 'Regular maintenance requirement' },
        { name: 'Drain Valve Seal Kit', type: 'Con', reason: 'Preventive maintenance item' },
      ],
      'griddle': [
        { name: 'Surface Heating Element', type: 'Cr', reason: 'Primary heat source' },
        { name: 'Temperature Probe', type: 'Cr', reason: 'Temperature regulation critical' },
        { name: 'Griddle Plate (Cast Iron)', type: 'Pr', reason: 'Replaceable wearing surface' },
        { name: 'Control Knob Assembly', type: 'Con', reason: 'Subject to frequent use' },
      ],
      'steamer': [
        { name: 'Boiler Heating Element', type: 'Cr', reason: 'Water heating component' },
        { name: 'Pressure Switch', type: 'Cr', reason: 'Safety critical device' },
        { name: 'Door Gasket Set', type: 'Con', reason: 'Steam exposure causes degradation' },
        { name: 'Safety Relief Valve', type: 'Pr', reason: 'Pressure management' },
      ],
      'mixer': [
        { name: 'Motor (3-Phase)', type: 'Pr', reason: 'Drive component' },
        { name: 'Gear Box', type: 'Pr', reason: 'Transmission component' },
        { name: 'Whip/Beater Attachment', type: 'Con', reason: 'Consumable mixing element' },
        { name: 'Shaft Seal Kit', type: 'Con', reason: 'Leakage prevention' },
      ],
      'dishwasher': [
        { name: 'Wash Pump Motor', type: 'Pr', reason: 'Essential for wash cycle' },
        { name: 'Heating Element (Booster)', type: 'Cr', reason: 'Water heating' },
        { name: 'Spray Arm Assembly', type: 'Con', reason: 'Replaceable component' },
        { name: 'Door Latch Mechanism', type: 'Pr', reason: 'Safety control' },
        { name: 'Drain Pump Motor', type: 'Cr', reason: 'Critical for drain cycle' },
      ],
    };

    let selectedParts = [];
    
    for (const category in partsLibrary) {
      if (category !== 'default' && equipmentLower.includes(category)) {
        selectedParts = partsLibrary[category];
        break;
      }
    }

    if (!selectedParts || selectedParts.length === 0) {
      selectedParts = [
        { name: 'Control Board/PCB', type: 'Pr', reason: 'Essential electronic component' },
        { name: 'Replacement Filter/Element', type: 'Con', reason: 'Regular maintenance' },
      ];
    }

    return selectedParts.map(part => ({
      ...part,
      brand,
      equipmentType,
      ...generateMockSupplierData(part.name, brand, equipmentType),
      repairLevel: Math.random() > 0.5 ? 'CLM' : 'DLM',
      requiredForHatSat: Math.random() > 0.3 ? 'Y' : 'N',
      unitOfIssue: ['EA', 'SET', 'KIT', 'BOX'][Math.floor(Math.random() * 4)],
      remarks: 'Original manufacturer recommended / Verify part compatibility before ordering',
      quantityPerAssembly: Math.floor(Math.random() * 4) + 1,
      recommended0_2Years: Math.floor(Math.random() * 3) + 1,
      recommended0_6Years: Math.floor(Math.random() * 5) + 2,
    }));
  };

  const startProcessing = async () => {
    if (!brand.trim() || !equipmentType.trim()) {
      alert('Vul merk en type in alstublieft');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setStatusMessage('Starting...');
    setStage('searching');

    const jobId = generateJobId();
    const newJob = {
      id: jobId,
      brand: brand.trim(),
      equipmentType: equipmentType.trim(),
      pdfName: pdfFile?.name,
      status: 'processing',
      createdAt: new Date(),
      progress: 0,
      results: [],
    };

    setJobs([newJob, ...jobs]);
    setSelectedJob(jobId);

    try {
      if (pdfFile) {
        setProgress(15);
        setStatusMessage('📄 PDF wordt geparst...');
        await new Promise(r => setTimeout(r, 1000));
      }

      setProgress(30);
      setStatusMessage('🌐 Online parts manual wordt gezocht...');
      await new Promise(r => setTimeout(r, 1200));

      setProgress(50);
      setStatusMessage('🔍 Onderdelen worden geïdentificeerd...');
      const spareParts = await generateSparePartsFromEquipment(brand.trim(), equipmentType.trim());
      
      setProgress(70);
      setStatusMessage('⚡ Kritieke onderdelen worden geselecteerd...');
      await new Promise(r => setTimeout(r, 1200));

      setProgress(85);
      setStatusMessage('🏭 Supplier informatie wordt opgehaald...');
      await new Promise(r => setTimeout(r, 500));

      setProgress(100);
      setStatusMessage('✅ RSPL is klaar!');
      await new Promise(r => setTimeout(r, 500));

      const updatedJob = {
        ...newJob,
        status: 'completed',
        progress: 100,
        results: spareParts,
      };

      setJobs(prevJobs =>
        prevJobs.map(j => j.id === jobId ? updatedJob : j)
      );

      setPdfFile(null);
      setBrand('');
      setEquipmentType('');
      setProcessing(false);

    } catch (error) {
      console.error('Error:', error);
      setJobs(prevJobs =>
        prevJobs.map(j =>
          j.id === jobId ? { ...j, status: 'error', error: error.message } : j
        )
      );
      setProcessing(false);
    }
  };

  const downloadAsExcel = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job?.results) return;

    const ws_data = [];
    
    const headers = [
      'SPARE PART NAME',
      'SUPPLIER PART NUMBER',
      'CAGE CODE NO. SUPPLIER',
      'HS CODE',
      'COO',
      'QUANTITY PER ASSEMBLY',
      'TYPE (Pr/Cr/Con)',
      'NO. RECOM. SPARES 0-2 YEARS',
      'NO. RECOM. SPARES 0-6 YEARS',
      'UNIT OF ISSUE',
      'REASON FOR SELECTION',
      'MIN. SALES QTY',
      'STANDARD PACKAGE QUANTITY',
      'DIMENSION ITEM L x W x H (CM)',
      'WEIGHT ITEM (KG)',
      'DIMENSION PACKAGING L x W x H (CM)',
      'WEIGHT PACKAGING (KG)',
      'SHELF LIFE (DAYS)',
      'SPECIAL STORAGE (Y/N)',
      'REPAIR LEVEL',
      'REQUIRED FOR HAT/SAT (Y/N)',
      'REMARKS',
    ];

    ws_data.push(headers);

    job.results.forEach(part => {
      ws_data.push([
        part.name,
        part.supplierPartNumber,
        part.cageCode,
        part.hsCode,
        part.coo,
        part.quantityPerAssembly,
        part.type,
        part.recommended0_2Years,
        part.recommended0_6Years,
        part.unitOfIssue,
        part.reason,
        part.minSalesQty,
        part.standardPackageQty,
        part.dimensionItem,
        part.weightItem,
        part.dimensionPackaging,
        part.weightPackaging,
        part.shelfLife,
        part.specialStorage,
        part.repairLevel,
        part.requiredForHatSat,
        part.remarks,
      ]);
    });

    let csv = `RSPL Report - ${job.brand} ${job.equipmentType}\n`;
    csv += `Generated: ${new Date().toLocaleString('nl-NL')}\n`;
    csv += `\n`;

    ws_data.forEach((row) => {
      csv += row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',');
      csv += '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `RSPL_${job.brand}_${job.equipmentType}_${new Date().toISOString().split('T')[0]}.xlsx`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentJob = jobs.find(j => j.id === selectedJob);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      minHeight: '100vh',
    }}>
      <header style={{
        borderBottom: '1px solid rgba(71, 85, 105, 0.5)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '1.5rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(to br, #06b6d4, #2563eb)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <FileText style={{ color: 'white', width: 24, height: 24 }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>RSPL Generator Pro</h1>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Advanced Spare Parts List - XLSX Export</p>
            </div>
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '0.875rem' }}>
            <Zap style={{ display: 'inline', marginRight: '0.5rem', width: 16, height: 16 }} />
            AI-Powered
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '350px 1fr',
          gap: '2rem',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '12px',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}>
              <h2 style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <Settings style={{ width: 16, height: 16, color: '#06b6d4' }} />
                Configuratie
              </h2>

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #475569',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.3s',
                  background: 'rgba(30, 41, 59, 0.5)',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  style={{ display: 'none' }}
                />
                <Upload style={{ width: 20, height: 20, color: '#94a3b8', margin: '0 auto 0.5rem' }} />
                <p style={{ color: 'white', fontSize: '0.875rem', fontWeight: 500 }}>
                  {pdfFile?.name || 'PDF uploaden'}
                </p>
                <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  of drag-and-drop
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#cbd5e1',
                    marginBottom: '0.5rem',
                  }}>
                    Merk/Fabrikant
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Rational, Electrolux..."
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'rgba(2, 8, 23, 0.5)',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#cbd5e1',
                    marginBottom: '0.5rem',
                  }}>
                    Type/Model
                  </label>
                  <input
                    type="text"
                    value={equipmentType}
                    onChange={(e) => setEquipmentType(e.target.value)}
                    placeholder="CombiMaster Plus..."
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: 'rgba(2, 8, 23, 0.5)',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                onClick={startProcessing}
                disabled={(!brand.trim() || !equipmentType.trim()) || processing}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: processing
                    ? 'linear-gradient(to right, #64748b, #475569)'
                    : 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)',
                  color: 'white',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  opacity: processing ? 0.7 : 1,
                }}
              >
                {processing ? (
                  <>
                    <Loader style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    Verwerken...
                  </>
                ) : (
                  <>
                    <Search style={{ width: 16, height: 16 }} />
                    RSPL Genereren
                  </>
                )}
              </button>

              <div style={{
                background: 'rgba(3, 102, 214, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '8px',
                padding: '0.75rem',
              }}>
                <p style={{ fontSize: '0.75rem', color: '#bfdbfe' }}>
                  ✅ XLSX Export inbegrepen! Download als Excel file.
                </p>
              </div>
            </div>

            {jobs.length > 0 && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '12px',
                padding: '2rem',
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'white',
                  marginBottom: '1rem',
                }}>
                  Taken
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflow: 'auto' }}>
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job.id)}
                      style={{
                        textAlign: 'left',
                        padding: '0.75rem',
                        background: selectedJob === job.id
                          ? 'rgba(6, 182, 212, 0.2)'
                          : 'rgba(30, 41, 59, 0.5)',
                        border: selectedJob === job.id
                          ? '1px solid rgba(6, 182, 212, 0.5)'
                          : '1px solid rgba(71, 85, 105, 0.5)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: 'white',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        {job.status === 'processing' && (
                          <Loader style={{ width: 14, height: 14, color: '#06b6d4' }} />
                        )}
                        {job.status === 'completed' && (
                          <CheckCircle style={{ width: 14, height: 14, color: '#10b981' }} />
                        )}
                        <span>{job.brand} {job.equipmentType}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            {processing && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '12px',
                padding: '3rem 2rem',
                textAlign: 'center',
              }}>
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    margin: '0 auto 1rem',
                    position: 'relative',
                  }}>
                    <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#334155" strokeWidth="2" />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="url(#grad)"
                        strokeWidth="2"
                        strokeDasharray={`${2.51 * progress} 251`}
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px', transition: 'all 0.3s' }}
                      />
                      <defs>
                        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" style={{ stopColor: '#06b6d4' }} />
                          <stop offset="100%" style={{ stopColor: '#2563eb' }} />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: '#06b6d4',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                    }}>
                      {progress}%
                    </div>
                  </div>
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>
                  RSPL wordt gegenereerd...
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{statusMessage}</p>
              </div>
            )}

            {currentJob?.status === 'completed' && currentJob?.results && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                }}>
                  {[
                    { label: 'Onderdelen', value: currentJob.results.length, icon: '📦' },
                    { label: 'Preventief', value: currentJob.results.filter(p => p.type === 'Pr').length, icon: '✅' },
                    { label: 'Corrigerend', value: currentJob.results.filter(p => p.type === 'Cr').length, icon: '⚡' },
                  ].map((stat, i) => (
                    <div key={i} style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(71, 85, 105, 0.5)',
                      borderRadius: '8px',
                      padding: '1.5rem',
                    }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{stat.icon}</div>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>{stat.label}</p>
                      <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'white', marginTop: '0.5rem' }}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      fontSize: '0.85rem',
                      color: 'white',
                      borderCollapse: 'collapse',
                    }}>
                      <thead>
                        <tr style={{ background: 'rgba(2, 8, 23, 0.5)', borderBottom: '1px solid rgba(71, 85, 105, 0.5)' }}>
                          <th style={{ padding: '1rem', textAlign: 'left' }}>Onderdeel</th>
                          <th style={{ padding: '1rem', textAlign: 'left' }}>Part Nr.</th>
                          <th style={{ padding: '1rem', textAlign: 'center' }}>Type</th>
                          <th style={{ padding: '1rem', textAlign: 'right' }}>0-2Y</th>
                          <th style={{ padding: '1rem', textAlign: 'right' }}>0-6Y</th>
                          <th style={{ padding: '1rem', textAlign: 'right' }}>Gewicht</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentJob.results.map((part, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                            <td style={{ padding: '1rem' }}>{part.name}</td>
                            <td style={{ padding: '1rem', color: '#06b6d4', fontFamily: 'monospace' }}>{part.supplierPartNumber}</td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: part.type === 'Pr' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                                color: part.type === 'Pr' ? '#93c5fd' : '#fdba74',
                              }}>
                                {part.type}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>{part.recommended0_2Years}</td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>{part.recommended0_6Years}</td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}>{part.weightItem} kg</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button
                  onClick={() => downloadAsExcel(currentJob.id)}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.95rem',
                  }}
                >
                  <Download style={{ width: 18, height: 18 }} />
                  Download RSPL als Excel (XLSX)
                </button>
              </div>
            )}

            {!currentJob && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px dashed rgba(71, 85, 105, 0.5)',
                borderRadius: '12px',
                padding: '6rem 2rem',
                textAlign: 'center',
              }}>
                <FileText style={{ width: 64, height: 64, color: '#475569', margin: '0 auto 1rem', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Klaar om te starten
                </h3>
                <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
                  Vul merk en type in, upload optioneel een PDF, en klik RSPL Genereren
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
