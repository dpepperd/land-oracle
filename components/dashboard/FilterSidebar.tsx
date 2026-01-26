"use client";

import { useState, useEffect, useRef } from 'react';
import { Lock, MapPin } from 'lucide-react';

/**
 * FIXED FilterSidebar
 * 
 * Key Changes:
 * 1. Auto-applies filters when spatial search is triggered (via initialFilters.spatialShape)
 * 2. Preserves spatial filters when other filters change
 * 3. Shows indicator when spatial filter is active
 * 4. Properly syncs state between parent and child
 */

const FLORIDA_COUNTIES = [
  'Alachua', 'Baker', 'Bay', 'Bradford', 'Brevard', 'Broward', 'Calhoun', 
  'Charlotte', 'Citrus', 'Clay', 'Collier', 'Columbia', 'DeSoto', 'Dixie', 
  'Duval', 'Escambia', 'Flagler', 'Franklin', 'Gadsden', 'Gilchrist', 
  'Glades', 'Gulf', 'Hamilton', 'Hardee', 'Hendry', 'Hernando', 
  'Highlands', 'Hillsborough', 'Holmes', 'Indian River', 'Jackson', 
  'Jefferson', 'Lafayette', 'Lake', 'Lee', 'Leon', 'Levy', 'Liberty', 
  'Madison', 'Manatee', 'Marion', 'Martin', 'Miami-Dade', 'Monroe', 
  'Nassau', 'Okaloosa', 'Okeechobee', 'Orange', 'Osceola', 'Palm Beach', 
  'Pasco', 'Pinellas', 'Polk', 'Putnam', 'Santa Rosa', 'Sarasota', 
  'Seminole', 'Saint Johns', 'St. Lucie', 'Sumter', 'Suwannee', 'Taylor', 
  'Union', 'Volusia', 'Wakulla', 'Walton', 'Washington'
];

const LAND_USE_DATA = [
  { label: 'Residential (00-09)', options: [
    { code: '000', label: '00 - Vacant Residential' },
    { code: '001', label: '01 - Single Family' },
    { code: '002', label: '02 - Mobile Homes' },
    { code: '003', label: '03 - Multi-Family (2-9 units)' },
    { code: '004', label: '04 - Condominiums' },
    { code: '005', label: '05 - Cooperatives' },
    { code: '006', label: '06 - Retirement Homes' },
    { code: '007', label: '07 - Misc Residential' },
    { code: '008', label: '08 - Multi-Family (10+ units)' },
    { code: '009', label: '09 - Undefined Residential' }
  ]},
  { label: 'Commercial (10-39)', options: [
    { code: '010', label: '10 - Vacant Commercial' },
    { code: '011', label: '11 - Stores One Story' },
    { code: '012', label: '12 - Mixed Use Commercial' },
    { code: '013', label: '13 - Department Stores' },
    { code: '014', label: '14 - Supermarkets' },
    { code: '015', label: '15 - Regional Shopping Centers' },
    { code: '016', label: '16 - Community Shopping Centers' },
    { code: '017', label: '17 - Stores Multi-Story' },
    { code: '018', label: '18 - Parking Lots/Mobile Home Parks' },
    { code: '019', label: '19 - Wholesale/Distribution' },
    { code: '020', label: '20 - Vacant Industrial (Comm)' },
    { code: '021', label: '21 - Food/Drug Stores' },
    { code: '022', label: '22 - Restaurants/Cafeterias' },
    { code: '023', label: '23 - Drive-In Restaurants' },
    { code: '024', label: '24 - Banks/Savings & Loans' },
    { code: '025', label: '25 - Office Buildings One Story' },
    { code: '026', label: '26 - Office Buildings Multi-Story' },
    { code: '027', label: '27 - Professional Service Buildings' },
    { code: '028', label: '28 - Airports/Marinas/Special' },
    { code: '029', label: '29 - Nightclubs/Bars' },
    { code: '030', label: '30 - Florists/Greenhouses' },
    { code: '031', label: '31 - Drive-In Theaters' },
    { code: '032', label: '32 - Enclosed Theaters/Auditoriums' },
    { code: '033', label: '33 - Drive-In/Convenience Markets' },
    { code: '034', label: '34 - Service Stations' },
    { code: '035', label: '35 - Car Washes' },
    { code: '036', label: '36 - Repair Garages' },
    { code: '037', label: '37 - Auto Sales/Marine Sales' },
    { code: '038', label: '38 - Public Storage/Warehouses' },
    { code: '039', label: '39 - Hotels/Motels' }
  ]},
  { label: 'Industrial (40-49)', options: [
    { code: '040', label: '40 - Vacant Industrial' },
    { code: '041', label: '41 - Light Manufacturing' },
    { code: '042', label: '42 - Heavy Industrial/Manufacturing' },
    { code: '043', label: '43 - Lumber Yards' },
    { code: '044', label: '44 - Packing Plants' },
    { code: '045', label: '45 - Canneries/Bottling' },
    { code: '046', label: '46 - Other Food Processing' },
    { code: '047', label: '47 - Mineral Processing' },
    { code: '048', label: '48 - Warehousing/Distribution Terminals' },
    { code: '049', label: '49 - Open Storage' }
  ]},
  { label: 'Agriculture (50-69)', options: [
    { code: '050', label: '50 - Cropland - Row Crops' },
    { code: '051', label: '51 - Timberland - Commercial Forest' },
    { code: '052', label: '52 - Pastureland - Improved' },
    { code: '053', label: '53 - Grazing Land - Native' },
    { code: '054', label: '54 - Cropland - Field Crops' },
    { code: '055', label: '55 - Cropland - Vegetable Crops' },
    { code: '056', label: '56 - Cropland - Citrus' },
    { code: '057', label: '57 - Cropland - Fruit (Non-Citrus)' },
    { code: '058', label: '58 - Cropland - Other Groves' },
    { code: '059', label: '59 - Specialty Farms' },
    { code: '060', label: '60 - Poultry Operations' },
    { code: '061', label: '61 - Dairies' },
    { code: '062', label: '62 - Livestock Feedlots' },
    { code: '063', label: '63 - Ornamentals - Misc Ag' },
    { code: '064', label: '64 - General Livestock Ranching' },
    { code: '065', label: '65 - Beef Cattle Ranching' },
    { code: '066', label: '66 - Horse Farms/Training' },
    { code: '067', label: '67 - Sod Farms' },
    { code: '068', label: '68 - Vacant Agricultural' },
    { code: '069', label: '69 - Other Agricultural' }
  ]},
  { label: 'Institutional (70-79)', options: [
    { code: '070', label: '70 - Vacant Institutional' },
    { code: '071', label: '71 - Churches' },
    { code: '072', label: '72 - Private Schools/Colleges' },
    { code: '073', label: '73 - Homes for Aged' },
    { code: '074', label: '74 - Clubs/Lodges' },
    { code: '075', label: '75 - Hospitals' },
    { code: '076', label: '76 - Mortuaries/Cemeteries' },
    { code: '077', label: '77 - Orphanages/Childcare' },
    { code: '078', label: '78 - Cultural Organizations' },
    { code: '079', label: '79 - Detention/Correctional' }
  ]},
  { label: 'Government (80-89)', options: [
    { code: '080', label: '80 - Vacant Governmental' },
    { code: '081', label: '81 - Military' },
    { code: '082', label: '82 - Forest/Parks/Recreational' },
    { code: '083', label: '83 - Public County Schools' },
    { code: '084', label: '84 - Colleges' },
    { code: '085', label: '85 - Hospitals' },
    { code: '086', label: '86 - County Government Services' },
    { code: '087', label: '87 - State Government Services' },
    { code: '088', label: '88 - Federal Government Services' },
    { code: '089', label: '89 - Municipal Government Services' }
  ]},
  { label: 'Miscellaneous (90-99)', options: [
    { code: '090', label: '90 - Leasehold Interests' },
    { code: '091', label: '91 - Utility Sites' },
    { code: '092', label: '92 - Mining Lands/Petroleum' },
    { code: '093', label: '93 - Subsurface Rights' },
    { code: '094', label: '94 - Right of Way' },
    { code: '095', label: '95 - Rivers/Lakes/Submerged' },
    { code: '096', label: '96 - Sewage Disposal' },
    { code: '097', label: '97 - Swamp/Marsh/Flood Plain' },
    { code: '098', label: '98 - Beach/Dunes/Vegetation' },
    { code: '099', label: '99 - Non-Agricultural Acreage' }
  ]}
];

interface FilterSidebarProps {
  onFilterChange: (filters: any) => void;
  initialFilters: any;
  userTier?: string;
  unlockedCounties?: string[];
  onUpsell?: () => void;
}

export default function FilterSidebar({ 
  onFilterChange, 
  initialFilters, 
  userTier = 'demo', 
  unlockedCounties = ['Baker'],
  onUpsell 
}: FilterSidebarProps) {
  const isInitialMount = useRef(true);
  const previousSpatialShapeRef = useRef<any>(null);
  
  const defaultAgCodes = [
    '050','051','052','053','054','055','056','057','058','059',
    '068', '099'
  ];
  
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    landUse: initialFilters.landUse?.length > 0 ? initialFilters.landUse : defaultAgCodes
  }));
  
  const [acreageMode, setAcreageMode] = useState<'preset' | 'custom'>('preset');
  const [localParcelId, setLocalParcelId] = useState(filters.parcelId || '');
  const [countySearch, setCountySearch] = useState('');
  const [landUseSearch, setLandUseSearch] = useState('');

  // KEY FIX: Sync with parent AND auto-apply when spatial shape changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousSpatialShapeRef.current = initialFilters.spatialShape;
      return;
    }
    
    // Detect if spatial shape has changed (new polygon drawn)
    const spatialShapeChanged = JSON.stringify(initialFilters.spatialShape) !== 
                                JSON.stringify(previousSpatialShapeRef.current);
    
    if (spatialShapeChanged && initialFilters.spatialShape) {
      console.log('[FilterSidebar] Spatial shape changed, auto-applying filters');
      
      // Merge current local filters with new spatial shape and trigger search
      const mergedFilters = {
        ...filters,
        spatialShape: initialFilters.spatialShape,
        minLat: initialFilters.minLat,
        maxLat: initialFilters.maxLat,
        minLon: initialFilters.minLon,
        maxLon: initialFilters.maxLon
      };
      
      setFilters(mergedFilters);
      previousSpatialShapeRef.current = initialFilters.spatialShape;
      
      // Auto-apply the merged filters
      onFilterChange(mergedFilters);
    } else {
      // Normal sync without auto-apply
      setFilters((prev: any) => ({
        ...prev,
        ...initialFilters
      }));
    }
  }, [initialFilters]);

  const handleChange = (key: string, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleCountyToggle = (county: string) => {
    const isLocked = !unlockedCounties.includes(county);
    if (isLocked) {
      if (onUpsell) onUpsell();
      return;
    }

    const current = filters.counties || [];
    const updated = current.includes(county)
      ? current.filter((c: string) => c !== county)
      : [...current, county];
    handleChange('counties', updated);
  };

  const handleLandUseToggle = (code: string) => {
    const current = filters.landUse || [];
    const updated = current.includes(code)
      ? current.filter((c: string) => c !== code)
      : [...current, code];
    handleChange('landUse', updated);
  };

  const setAcreageRange = (min: number | undefined, max: number | undefined) => {
    setFilters((prev: any) => ({ ...prev, acreageMin: min, acreageMax: max }));
  };

  // KEY FIX: Preserve spatial filters when applying
  const handleApply = () => {
    // Include spatial filters from initialFilters if they exist
    const filtersToApply = {
      ...filters,
      spatialShape: initialFilters.spatialShape || filters.spatialShape,
      minLat: initialFilters.minLat || filters.minLat,
      maxLat: initialFilters.maxLat || filters.maxLat,
      minLon: initialFilters.minLon || filters.minLon,
      maxLon: initialFilters.maxLon || filters.maxLon
    };
    onFilterChange(filtersToApply);
  };

  const handleReset = () => {
    const reset = {
      counties: [],
      landUse: [],
      acreageMin: 0,
      acreageMax: 100,
      marketValueMin: undefined,
      marketValueMax: undefined,
      maxDistance: 0,
      ownerType: 'all',
      limit: 1000,
      // EXPLICITLY clear spatial filters
      spatialShape: null,
      minLat: undefined,
      maxLat: undefined,
      minLon: undefined,
      maxLon: undefined
    };
    setFilters(reset);
    onFilterChange(reset);
    setAcreageMode('preset');
    previousSpatialShapeRef.current = null;
  };

  const isGroupSelected = (options: { code: string }[]) => {
    return options.every(opt => (filters.landUse || []).includes(opt.code));
  };

  const toggleGroup = (options: { code: string }[]) => {
    const allSelected = isGroupSelected(options);
    const current = filters.landUse || [];
    let updated;
    
    if (allSelected) {
      const codesToRemove = options.map(o => o.code);
      updated = current.filter((c: string) => !codesToRemove.includes(c));
    } else {
      const newCodes = options.map(o => o.code).filter(c => !current.includes(c));
      updated = [...current, ...newCodes];
    }
    handleChange('landUse', updated);
  };

  const handleParcelSearch = () => {
    onFilterChange({ ...filters, parcelId: localParcelId });
  };

  // Check if spatial filter is active
  const hasSpatialFilter = !!(initialFilters.spatialShape && 
    typeof initialFilters.spatialShape === 'object' && 
    Object.keys(initialFilters.spatialShape).length > 0);

  return (
    <div className="w-80 flex-shrink-0 bg-theme-sidebar border-r border-theme h-full overflow-y-auto p-4 flex flex-col gap-6 font-medium">
      <div>
        <h2 className="text-xl font-extrabold text-white mb-4 tracking-tight">FILTERS</h2>

        {/* SPATIAL FILTER INDICATOR */}
        {hasSpatialFilter && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <MapPin size={16} />
              <span className="text-sm font-semibold">Custom Area Active</span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Results filtered to drawn polygon
            </p>
          </div>
        )}

        {/* Parcel ID Search */}
        <div className="mb-6 p-3 bg-theme-input rounded border border-theme">
          <label className="block text-base font-bold text-white mb-2 uppercase tracking-wide">
            Find by Parcel ID
          </label>
          <div className="flex flex-col gap-2">
            <input 
              type="text"
              placeholder="Enter ID (e.g. 011N...)"
              className="w-full p-2 text-sm border border-theme rounded bg-white dark:bg-slate-800 text-theme-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={localParcelId}
              onChange={(e) => setLocalParcelId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleParcelSearch()}
            />
            <button 
              onClick={handleParcelSearch}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded shadow-sm transition-colors"
            >
              Search Record
            </button>
          </div>
        </div>
        
        {/* Counties */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-base font-bold text-white uppercase tracking-wide">
              Counties <span className="text-xs font-normal text-slate-300 ml-1">({(filters.counties || []).length})</span>
            </label>
            <button
              onClick={() => { handleChange('counties', []); setCountySearch(''); }}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              Reset
            </button>
          </div>
          
          {/* County Search */}
          <div className="mb-2">
             <input 
                type="text"
                placeholder="Type to filter..."
                value={countySearch}
                onChange={(e) => setCountySearch(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
             />
          </div>

          <div className="h-40 overflow-y-auto border border-theme rounded p-2 bg-theme-input shadow-sm">
            {FLORIDA_COUNTIES
              .filter(c => c.toLowerCase().includes(countySearch.toLowerCase()))
              .map(county => {
              const isLocked = county !== 'Baker' && !unlockedCounties.includes(county);
              const isChecked = (filters.counties || []).includes(county);

              if (isLocked) {
                return (
                  <div 
                    key={county}
                    className="flex items-center justify-between p-1 rounded cursor-pointer transition-colors opacity-60 hover:bg-gray-100"
                    onClick={() => onUpsell?.()}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 rounded border border-gray-400 bg-gray-100 flex items-center justify-center">
                        <Lock size={10} className="text-gray-400" />
                      </div>
                      <span className="text-sm text-gray-500">{county}</span>
                    </div>
                    <Lock size={12} className="text-gray-400" />
                  </div>
                );
              }

              return (
                <label 
                  key={county} 
                  className="flex items-center justify-between p-1 rounded cursor-pointer transition-colors hover:bg-theme-sidebar"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleCountyToggle(county)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-theme-primary">{county}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Land Use */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-base font-bold text-white uppercase tracking-wide">
              Land Use <span className="text-xs font-normal text-slate-300 ml-1">({(filters.landUse || []).length})</span>
            </label>
            <button 
              onClick={() => { handleChange('landUse', []); setLandUseSearch(''); }}
              className="text-xs text-red-400 hover:text-red-300 font-medium"
            >
              Reset
            </button>
          </div>

           {/* Land Use Search */}
           <div className="mb-2">
             <input 
                type="text"
                placeholder="Search codes..."
                value={landUseSearch}
                onChange={(e) => setLandUseSearch(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
             />
          </div>

          <div className="h-64 overflow-y-auto border border-theme rounded p-2 bg-theme-input">
            {LAND_USE_DATA.map((group) => {
               // Filter options in this group
               const filteredOptions = group.options.filter(opt => 
                  opt.label.toLowerCase().includes(landUseSearch.toLowerCase()) || 
                  opt.code.includes(landUseSearch)
               );
               
               // If no options match and search is active, hide group
               if (filteredOptions.length === 0 && landUseSearch) return null;

               return (
                <div key={group.label} className="mb-3">
                  <div className="flex items-center justify-between sticky top-0 bg-theme-input z-10 py-1 border-b border-theme/50 mb-1">
                    <span className="text-xs font-bold text-theme-secondary uppercase tracking-wide">{group.label}</span>
                    <button 
                      onClick={() => toggleGroup(group.options)} // Toggle original group options? Or only filtered? Let's toggle original for consistency or filtered? Original is safer logic.
                      className="text-[10px] text-blue-400 hover:underline px-2"
                    >
                      {isGroupSelected(group.options) ? 'None' : 'All'}
                    </button>
                  </div>
                  <div className="pl-1 space-y-0.5">
                    {filteredOptions.map(lu => (
                    <label key={lu.code} className="flex items-center space-x-2 p-1 hover:bg-theme-sidebar rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(filters.landUse || []).includes(lu.code)}
                        onChange={() => handleLandUseToggle(lu.code)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-theme-primary truncate" title={lu.label}>
                        {lu.label}
                      </span>
                    </label>
                  ))}
                </div>
                  </div>
               );
            })}
          </div>
        </div>

        {/* Acreage */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-base font-bold text-white uppercase tracking-wide">Acreage</label>
            <div className="flex text-xs border border-theme rounded overflow-hidden">
              <button 
                className={`px-2 py-0.5 ${acreageMode === 'preset' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-theme-input text-theme-secondary'}`}
                onClick={() => setAcreageMode('preset')}
              >
                Preset
              </button>
              <button 
                className={`px-2 py-0.5 ${acreageMode === 'custom' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-theme-input text-theme-secondary'}`}
                onClick={() => setAcreageMode('custom')}
              >
                Custom
              </button>
            </div>
          </div>
          
          {acreageMode === 'preset' ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Small (3-9)', min: 3, max: 9 },
                { label: 'Med (10-20)', min: 10, max: 20 },
                { label: 'Large (20-40)', min: 20, max: 40 },
                { label: 'XL (40+)', min: 40, max: 99999 }
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setAcreageRange(preset.min, preset.max)}
                  className={`py-2 px-1 text-xs border rounded transition-colors ${
                    filters.acreageMin === preset.min && filters.acreageMax === preset.max
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-theme-input border-theme text-theme-primary hover:border-blue-400'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={filters.acreageMin || ''}
                onChange={(e) => handleChange('acreageMin', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-theme rounded-md bg-theme-input text-theme-primary text-sm"
                placeholder="Min"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                value={filters.acreageMax || ''}
                onChange={(e) => handleChange('acreageMax', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-theme rounded-md bg-theme-input text-theme-primary text-sm"
                placeholder="Max"
              />
            </div>
          )}
        </div>

        {/* Market Value */}
        <div className="mb-6">
          <label className="block text-base font-bold text-white mb-2 uppercase tracking-wide">Market Value ($)</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={filters.marketValueMin || ''}
              onChange={(e) => handleChange('marketValueMin', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-theme rounded-md bg-theme-input text-theme-primary text-sm"
              placeholder="Min $"
            />
            <span className="text-gray-400">-</span>
            <input
              type="number"
              value={filters.marketValueMax || ''}
              onChange={(e) => handleChange('marketValueMax', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-theme rounded-md bg-theme-input text-theme-primary text-sm"
              placeholder="Max $"
            />
          </div>
        </div>

        {/* Owner Type */}
        <div className="mb-6">
          <label className="block text-base font-bold text-white mb-2 uppercase tracking-wide">Owner Type</label>
          <div className="flex border border-theme rounded-md overflow-hidden">
            {[
              { id: 'all', label: 'All' },
              { id: 'in_state', label: 'In State' },
              { id: 'out_of_state', label: 'Out of State' }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => handleChange('ownerType', type.id)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  filters.ownerType === type.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-theme-input text-theme-primary hover:bg-theme-sidebar'
                } ${type.id !== 'out_of_state' ? 'border-r border-theme' : ''}`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Distance from Highway */}
        <div className="mb-6">
          <label className="flex items-center space-x-2 cursor-pointer mb-2">
            <input 
              type="checkbox"
              checked={filters.maxDistance > 0}
              onChange={(e) => handleChange('maxDistance', e.target.checked ? 5 : 0)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-base font-bold text-white uppercase tracking-wide">Limit Distance to Highway</span>
          </label>
          
          {filters.maxDistance > 0 && (
            <div className="pl-1">
              <div className="flex justify-between text-xs text-theme-secondary mb-1">
                <span>1 mile</span>
                <span className="font-semibold text-blue-600">{filters.maxDistance} miles</span>
                <span>50 miles</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={filters.maxDistance}
                onChange={(e) => handleChange('maxDistance', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* View Limit */}
        <div className="mb-6">
          <label className="block text-base font-bold text-white mb-2 uppercase tracking-wide">Map View Limit</label>
          <select 
            value={filters.limit}
            onChange={(e) => handleChange('limit', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-theme rounded-md bg-theme-input text-theme-primary text-sm"
          >
            <option value={100}>100 records</option>
            <option value={500}>500 records</option>
            <option value={1000}>1,000 records</option>
            <option value={2000}>2,000 records</option>
            <option value={5000}>5,000 records</option>
          </select>
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-4 border-t border-theme">
        <button
          onClick={handleApply}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm transition-colors"
        >
          Apply Filters
        </button>
        <button
          onClick={handleReset}
          className="w-full py-2 px-4 bg-theme-input border border-theme text-theme-primary font-medium rounded-md hover:bg-theme-sidebar transition-colors"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}
