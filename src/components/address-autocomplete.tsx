import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

// Types
export interface PlaceResult {
  formattedAddress: string;
  cidade: string;
  latitude: number;
  longitude: number;
  cep?: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
}

// Mock addresses for Sorocaba, Votorantim e Itu (offline mode)
const MOCK_PLACES = [
  {
    formattedAddress: "Avenida Dom Aguirre, 1500 - Jardim Santa Rosália, Sorocaba - SP",
    cidade: "Sorocaba",
    latitude: -23.4975,
    longitude: -47.4522,
    cep: "18090-002",
  },
  {
    formattedAddress: "Avenida Gisele Constantino, 1850 - Parque Campolim, Votorantim - SP",
    cidade: "Votorantim",
    latitude: -23.5411,
    longitude: -47.4647,
    cep: "18110-650",
  },
  {
    formattedAddress: "Rua Floriano Peixoto, 450 - Centro, Itu - SP",
    cidade: "Itu",
    latitude: -23.2642,
    longitude: -47.2991,
    cep: "13300-005",
  },
  {
    formattedAddress: "Avenida Dr. Afonso Vergueiro, 823 - Centro, Sorocaba - SP",
    cidade: "Sorocaba",
    latitude: -23.4952,
    longitude: -47.4618,
    cep: "18040-000",
  },
  {
    formattedAddress: "Rua da Penha, 200 - Centro, Sorocaba - SP",
    cidade: "Sorocaba",
    latitude: -23.5008,
    longitude: -47.4592,
    cep: "18010-001",
  },
];

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Digite o endereço da obra...",
  className = "",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<typeof MOCK_PLACES>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (key && key !== "") {
      setApiKeySet(true);
      loadGoogleMapsScript(key);
    }
  }, []);

  const loadGoogleMapsScript = (key: string) => {
    if (window.google?.maps?.places) {
      initAutocomplete();
      return;
    }

    // Check if script is already injected
    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) return;

    setIsLoading(true);
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsLoading(false);
      initAutocomplete();
    };
    script.onerror = () => {
      setIsLoading(false);
      console.error("Erro ao carregar o script do Google Maps.");
    };
    document.head.appendChild(script);
  };

  const initAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "br" },
      fields: ["formatted_address", "geometry", "address_components"],
      types: ["address"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const address = place.formatted_address || "";

      // Encontrar cidade e CEP nos components do endereço
      let cidade = "Sorocaba"; // default
      let cep = "";

      if (place.address_components) {
        for (const comp of place.address_components) {
          if (comp.types.includes("administrative_area_level_2")) {
            cidade = comp.long_name;
          }
          if (comp.types.includes("postal_code")) {
            cep = comp.long_name;
          }
        }
      }

      onChange(address);
      onPlaceSelected({
        formattedAddress: address,
        cidade,
        latitude: lat,
        longitude: lng,
        cep,
      });
    });
  };

  // Mock handlers when API Key is missing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (!apiKeySet) {
      if (val.length > 2) {
        const filtered = MOCK_PLACES.filter((p) =>
          p.formattedAddress.toLowerCase().includes(val.toLowerCase())
        );
        setSuggestions(filtered.length > 0 ? filtered : MOCK_PLACES.slice(0, 3));
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }
  };

  const handleSuggestionClick = (place: typeof MOCK_PLACES[0]) => {
    onChange(place.formattedAddress);
    onPlaceSelected({
      formattedAddress: place.formattedAddress,
      cidade: place.cidade,
      latitude: place.latitude,
      longitude: place.longitude,
      cep: place.cep,
    });
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
          className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10 ${className}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </div>
      </div>

      {/* Mock suggestions box */}
      {!apiKeySet && showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none animate-in fade-in-50 slide-in-from-top-1">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Endereços Sugeridos (Offline Mock)
          </div>
          {suggestions.map((s) => (
            <button
              key={s.formattedAddress}
              type="button"
              onClick={() => handleSuggestionClick(s)}
              className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-left"
            >
              <MapPin className="mr-2 h-4 w-4 text-primary opacity-70" />
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{s.formattedAddress}</span>
                <span className="text-xs text-muted-foreground">{s.cidade} · Lat: {s.latitude.toFixed(4)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {apiKeySet && (
        <span className="mt-1 block text-[10px] text-green-500">
          Google Maps Autocomplete ativo
        </span>
      )}
      {!apiKeySet && (
        <span className="mt-1 block text-[10px] text-amber-500">
          Google Maps em modo simulação (digite Sorocaba ou Itu para testar)
        </span>
      )}
    </div>
  );
}
