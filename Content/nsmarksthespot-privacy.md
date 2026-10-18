
# NS Marks The Spot Privacy Policy

NS Marks The Spot is made by Daniel Vincent Fakkeldy, operating as KinNoKi Labs. This policy describes the native iPhone and iPad app. You can use the app without creating an NS Marks account. Your imported maps, drawings, saved marks and tracks, attached photos and app settings are stored on the device. The app's map and property-research features also contact the services described below.

## Map and public-data requests

Apple MapKit provides Apple map backgrounds and related system services. Selected OpenStreetMap backgrounds request tiles from `tile.openstreetmap.org`. Atlas and Fletcher map imagery is delivered from KinNoKi's `tiles.kinnokilabs.com` host. Available layers and property lookups request data directly from the provincial, municipal and other public-data sources named in the app's attribution. Province-restricted features require the corrected Province disclosure before they can request or display restricted material. Some layers and export types are unavailable while permission for their use is unresolved; the app identifies held sources and provides official links.

Requests can include the map area and zoom level, a selected point or parcel outline, a parcel identifier, civic-address search terms or assessment account numbers. The services receive your network address and normal HTTP information needed to handle the request. Some tile requests identify the app and its version in a User-Agent header; that header does not assign a unique user or device identifier.

These requests let the app draw the map, search published records and obtain evidence for the selected property. A returned public assessment or zoning record is different from a private file you import into the app. Providers may keep request records under their own policies. [OpenStreetMap Foundation](https://osmfoundation.org/wiki/Privacy_Policy) describes network/access records; [Nova Scotia](https://www.novascotia.ca/privacy) describes IP addresses and web-server logs; [Esri](https://www.esri.com/en-us/privacy/privacy-statements/privacy-statement) describes its ArcGIS-related privacy practices. The operator of each municipal or public-data service also determines its practices.

KinNoKi's Fletcher tile host uses Cloudflare R2. The Fletcher bucket's optional Data Access Logs feature is currently disabled. Cloudflare still processes connection and request information for service delivery and security as described in its [privacy policy](https://www.cloudflare.com/privacypolicy/). That setting does not establish that Cloudflare keeps no operational or security records. No universal retention period or deletion deadline for those separate provider records has been verified. Atlas map requests also use the KinNoKi tile hostname.

## Location and track recording

Location access is optional. With permission, the app can show your position, place a mark or record a track. The app requests When In Use authorization. An active recording can continue off screen when iOS permits background location updates. The device can provide precise location when your system settings allow it.

Recorded track files are stored locally. System backups may include saved library files, depending on your device settings. You choose any export or sharing destination. When the map follows your position or you view an area around a photo location, map and layer requests can disclose the area being viewed. Keeping the track file local does not prevent those separate map requests.

The recording Live Activity displays elapsed time, distance and recording status on the Lock Screen. Its activity content does not include coordinates, and it does not use a remote activity-push server.

## Photos, imported files and offline areas

Camera access is optional for taking feature photos. Attaching selected images uses the system photo picker. The optional Photo map requests Photos access to display accessible geotagged library images on the map. The app stores attached photo files locally. Apple Photos can download selected images from your iCloud Photos account when needed. The app does not automatically upload your photos, imported maps or track files to a KinNoKi storage service in these features.

Saving an offline area downloads Fletcher map tiles for the chosen area into local storage. The tile provider receives the requests for that area. The offline download does not upload your track or photo files. Some local data can be included in system backups according to your device settings; the active recording checkpoint directory is excluded from backups.

## Sharing, exports and outbound links

Exports and the share sheet send the selected materials to destinations you choose. Those materials may contain coordinates, notes or photos. A shared map link includes the selected map position, zoom and map state. When the link is opened, its URL can be received by the website host.

Opening driving directions passes the selected destination to Google Maps. Opening ViewPoint passes the selected parcel identifier to that site. Those services and any other source links you open apply their own policies. Sharing an exported file or opening a link does not delete local or recipient copies.

## Your controls and support

You can deny or change location, Precise Location, Camera and Photos permissions in iOS Settings, stop a recording, choose which layers to request, and remove local content or offline downloads using the app's controls. Removing local data does not delete providers' request records, system backups or copies you previously exported.

If you email support, we receive your email address and whatever you send. We retain support emails indefinitely. We do not currently operate a support-email deletion system. The app's feedback link can prepare a subject containing the app version; you choose whether to send the email. For app support contact [map@kinnokilabs.com](mailto:map@kinnokilabs.com). For privacy questions or requests contact [hello@kinnokilabs.com](mailto:hello@kinnokilabs.com). Mail sent to these KinNoKi support and privacy addresses is routed through Apple iCloud Mail, subject to [Apple's privacy policy](https://www.apple.com/legal/privacy/en-ww/).
