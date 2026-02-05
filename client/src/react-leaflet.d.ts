declare module 'react-leaflet' {
  import { FC, ReactNode } from 'react';
  import * as L from 'leaflet';

  interface MapContainerProps {
    center: [number, number];
    zoom: number;
    style?: React.CSSProperties;
    children?: ReactNode;
    attributionControl?: boolean;
    className?: string;
  }

  interface TileLayerProps {
    url: string;
    attribution?: string;
  }

  interface MarkerProps {
    position: [number, number];
    icon?: L.DivIcon | L.Icon;
    children?: ReactNode;
  }

  interface CircleProps {
    center: [number, number];
    radius: number;
    pathOptions?: L.PathOptions;
  }

  interface PopupProps {
    children?: ReactNode;
  }

  export const MapContainer: FC<MapContainerProps>;
  export const TileLayer: FC<TileLayerProps>;
  export const Marker: FC<MarkerProps>;
  export const Circle: FC<CircleProps>;
  export const Popup: FC<PopupProps>;
  
  export function useMapEvents(handlers: {
    click?: (e: L.LeafletMouseEvent) => void;
    [key: string]: any;
  }): L.Map;
  
  export function useMap(): L.Map;
}
