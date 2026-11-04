// leaflet.markercluster is a UMD plugin that reads the global `L`, so L must be
// on window before that module evaluates. Kept in its own module because
// imports are hoisted: an assignment next to the import would run too late.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Bundlers break Leaflet's CSS-based detection of the default marker image path.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

window.L = L;
export default L;
