import React, { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

export interface PlaceResult {
  formattedAddress: string;
  cidade: string;
  latitude: number;
  longitude: number;
  cep?: string;
  numero?: string;
  bairro?: string;
  estado?: string;
  logradouro?: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
}

// Mock addresses for offline mode
const MOCK_PLACES = [
  {
    formattedAddress: "Avenida Dom Aguirre, 1500 - Jardim Santa Rosália, Sorocaba - SP",
    cidade: "Sorocaba", latitude: -23.4975, longitude: -47.4522, cep: "18090-002",
    bairro: "Jardim Santa Rosália", estado: "SP",
  },
  {
    formattedAddress: "Avenida Gisele Constantino, 1850 - Parque Campolim, Votorantim - SP",
    cidade: "Votorantim", latitude: -23.5411, longitude: -47.4647, cep: "18110-650",
    bairro: "Parque Campolim", estado: "SP",
  },
  {
    formattedAddress: "Rua Floriano Peixoto, 450 - Centro, Itu - SP",
    cidade: "Itu", latitude: -23.2642, longitude: -47.2991, cep: "13300-005",
    bairro: "Centro", estado: "SP",
  },
];

declare global {
  interface Window {
    google: any;
    initGoogleAutocomplete?: () => void;
  }
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Digite o endereço da obra...",
  className = "",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [suggestions, setSuggestions] = useState<typeof MOCK_PLACES>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);

  // Init Google Maps
  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) return;
    setApiKeySet(true);

    if (window.google?.maps?.places) {
      setMapsReady(true);
      return;
    }

    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => setMapsReady(true));
      return;
    }

    setIsLoading(true);
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsLoading(false);
      setMapsReady(true);
    };
    script.onerror = () => {
      setIsLoading(false);
      setApiKeySet(false);
    };
    document.head.appendChild(script);
  }, []);

  // Attach Autocomplete once Maps is ready and input is mounted
  useEffect(() => {
    if (!mapsReady || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "br" },
      fields: ["formatted_address", "geometry", "address_components"],
      types: ["address"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const address = place.formatted_address || "";

      let cidade = "";
      let cep = "";
      let bairro = "";
      let estado = "";
      let numero = "";
      let logradouro = "";

      if (place.address_components) {
        for (const comp of place.address_components) {
          if (comp.types.includes("route")) logradouro = comp.long_name;
          if (comp.types.includes("street_number")) numero = comp.long_name;
          if (comp.types.includes("sublocality_level_1") || comp.types.includes("neighborhood"))
            bairro = comp.long_name;
          if (comp.types.includes("administrative_area_level_2")) cidade = comp.long_name;
          if (comp.types.includes("administrative_area_level_1")) estado = comp.short_name;
          if (comp.types.includes("postal_code")) cep = comp.long_name.replace("-", "");
        }
      }

      onChange(address);
      onPlaceSelected({ formattedAddress: address, cidade, latitude: lat, longitude: lng, cep, bairro, estado, numero, logradouro });
    });

    autocompleteRef.current = autocomplete;
  }, [mapsReady, onChange, onPlaceSelected]);

  // CEP lookup via ViaCEP (works without Google Maps key)
  const handleCEPBlur = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) return;

      const address = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
      onChange(address);
      onPlaceSelected({
        formattedAddress: address,
        cidade: data.localidade,
        latitude: 0,
        longitude: 0,
        cep: clean,
        bairro: data.bairro,
        estado: data.uf,
        logradouro: data.logradouro,
      });
    } catch (_) {}
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (!apiKeySet && val.length > 2) {
      const filtered = MOCK_PLACES.filter((p) =>
        p.formattedAddress.toLowerCase().includes(val.toLowerCase())
      );
      setSuggestions(filtered.length > 0 ? filtered : MOCK_PLACES.slice(0, 3));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (place: typeof MOCK_PLACES[0]) => {
    onChange(place.formattedAddress);
    onPlaceSelected(place);
    setShowSuggestions(false);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => !apiKeySet && value.length > 2 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10 ${className}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </div>
      </div>

      {!apiKeySet && showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none animate-in fade-in-50">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Sugestões (modo offline)</div>
          {suggestions.map((s) => (
            <button key={s.formattedAddress} type="button" onClick={() => handleSuggestionClick(s)}
              className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-left">
              <MapPin className="mr-2 h-4 w-4 text-primary opacity-70 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{s.formattedAddress}</span>
                <span className="text-xs text-muted-foreground">{s.cidade}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {apiKeySet && mapsReady && (
        <span className="mt-1 block text-[10px] text-green-500">Google Maps Autocomplete ativo</span>
      )}
      {apiKeySet && !mapsReady && !isLoading && (
        <span className="mt-1 block text-[10px] text-amber-500">Aguardando Google Maps...</span>
      )}
      {!apiKeySet && (
        <span className="mt-1 block text-[10px] text-amber-500">Modo simulação — configure VITE_GOOGLE_MAPS_API_KEY</span>
      )}
    </div>
  );
}

// Standalone CEP lookup helper — used directly in the form
export async function lookupCEP(cep: string): Promise<Partial<PlaceResult> | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      formattedAddress: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`,
      cidade: data.localidade,
      cep: clean,
      bairro: data.bairro,
      estado: data.uf,
      logradouro: data.logradouro,
      latitude: 0,
      longitude: 0,
    };
  } catch (_) {
    return null;
  }
}
