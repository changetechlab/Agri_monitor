import geopandas as gpd
import json

gdf = gpd.read_file('output/uttarakhand_gp.geojson')

gps = []
for idx, row in gdf.iterrows():
    gp_code = str(row['gpcode'])
    dtname = str(row['dtname']).title()
    blkname = str(row['blkname']).title()
    gpname = str(row['gp_name']).title()
    
    lat = (row['ymin'] + row['ymax']) / 2 if row['ymin'] else 30.0
    lng = (row['xmin'] + row['xmax']) / 2 if row['xmin'] else 79.0
    
    gps.append({
        'id': f"gp_{gp_code}",
        'name': gpname,
        'name_hindi': gpname,
        'district': dtname,
        'district_hindi': dtname,
        'block': blkname,
        'block_hindi': blkname,
        'gp_code': gp_code,
        'lat': lat,
        'lng': lng,
        'avg_ndvi': 0.45,
        'water_availability': 'seasonal',
        'slope': 'moderate',
        'total_area_ha': 400,
        'agri_area_ha': 200,
        'total_farmers': 300,
        'primary_crops': ['मंडुआ', 'गेहूं'],
        'climate_hazards': ['drought'],
        'landslide_risk': 'moderate',
        'fire_risk_class': 'low',
        'slope_breakup': { 'flat': 20, 'gentle': 35, 'moderate': 30, 'steep': 12, 'very_steep': 3 }
    })

js_content = f"""window.ALL_UTTARAKHAND_GPS = {json.dumps(gps)};
// Inject into GP_CRA_DATA if exists
if (window.GP_CRA_DATA) {{
    window.GP_CRA_DATA.gp_list = window.ALL_UTTARAKHAND_GPS;
    window.GP_CRA_DATA.getDistricts = function() {{
        return [...new Set(this.gp_list.map(g => g.district))].sort();
    }};
    window.GP_CRA_DATA.getBlocksByDistrict = function(dist) {{
        return [...new Set(this.gp_list.filter(g => g.district === dist).map(g => g.block))].sort();
    }};
    window.GP_CRA_DATA.getByBlock = function(block) {{
        return this.gp_list.filter(g => g.block === block).sort((a,b) => a.name.localeCompare(b.name));
    }};
}}
"""

with open('../data/all_uttarakhand_gps.js', 'w', encoding='utf-8') as f:
    f.write(js_content)
