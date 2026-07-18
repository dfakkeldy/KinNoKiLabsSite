const linearUnit = (id, label, factor) => Object.freeze({ id, label, factor });

const temperatureUnit = (id, label, toBase, fromBase) => Object.freeze({
  id, label, toBase, fromBase,
});

const category = (id, label, units) => Object.freeze({ id, label, units: Object.freeze(units) });

export const CATEGORIES = Object.freeze([
  category('length', 'Length', [
    linearUnit('mm', 'Millimetres (mm)', 0.001),
    linearUnit('cm', 'Centimetres (cm)', 0.01),
    linearUnit('m', 'Metres (m)', 1),
    linearUnit('km', 'Kilometres (km)', 1000),
    linearUnit('in', 'Inches (in)', 0.0254),
    linearUnit('ft', 'Feet (ft)', 0.3048),
    linearUnit('yd', 'Yards (yd)', 0.9144),
    linearUnit('mi', 'Miles (mi)', 1609.344),
  ]),
  category('mass', 'Mass', [
    linearUnit('g', 'Grams (g)', 0.001),
    linearUnit('kg', 'Kilograms (kg)', 1),
    linearUnit('t', 'Metric tonnes (t)', 1000),
    linearUnit('oz', 'Ounces (oz)', 0.0283495231),
    linearUnit('lb', 'Pounds (lb)', 0.45359237),
    linearUnit('st', 'Stone (st)', 6.35029318),
  ]),
  category('temperature', 'Temperature', [
    temperatureUnit('c', 'Celsius (°C)', (value) => value + 273.15, (value) => value - 273.15),
    temperatureUnit('f', 'Fahrenheit (°F)', (value) => (value - 32) * 5 / 9 + 273.15, (value) => (value - 273.15) * 9 / 5 + 32),
    temperatureUnit('k', 'Kelvin (K)', (value) => value, (value) => value),
  ]),
  category('volume', 'Volume', [
    linearUnit('ml', 'Millilitres (ml)', 0.001),
    linearUnit('l', 'Litres (L)', 1),
    linearUnit('tsp', 'Teaspoons (US)', 0.00492892),
    linearUnit('tbsp', 'Tablespoons (US)', 0.0147868),
    linearUnit('floz', 'Fluid ounces (US)', 0.0295735),
    linearUnit('cup', 'Cups (US)', 0.236588),
    linearUnit('pt', 'Pints (US)', 0.473176),
    linearUnit('gal', 'Gallons (US)', 3.78541),
  ]),
  category('area', 'Area', [
    linearUnit('cm2', 'Square centimetres (cm²)', 0.0001),
    linearUnit('m2', 'Square metres (m²)', 1),
    linearUnit('ha', 'Hectares (ha)', 10000),
    linearUnit('km2', 'Square kilometres (km²)', 1e6),
    linearUnit('ft2', 'Square feet (ft²)', 0.09290304),
    linearUnit('ac', 'Acres (ac)', 4046.8564224),
  ]),
  category('speed', 'Speed', [
    linearUnit('kmh', 'Kilometres per hour (km/h)', 1 / 3.6),
    linearUnit('mph', 'Miles per hour (mph)', 0.44704),
    linearUnit('ms', 'Metres per second (m/s)', 1),
    linearUnit('kn', 'Knots (kn)', 0.514444),
  ]),
  category('data', 'Data', [
    linearUnit('b', 'Bytes (B)', 1),
    linearUnit('kb', 'Kilobytes (KB)', 1e3),
    linearUnit('mb', 'Megabytes (MB)', 1e6),
    linearUnit('gb', 'Gigabytes (GB)', 1e9),
    linearUnit('tb', 'Terabytes (TB)', 1e12),
    linearUnit('kib', 'Kibibytes (KiB)', 1024),
    linearUnit('mib', 'Mebibytes (MiB)', 1048576),
    linearUnit('gib', 'Gibibytes (GiB)', 1073741824),
  ]),
]);

const findCategory = (id) => CATEGORIES.find((category) => category.id === id) ?? null;
const findUnit = (category, id) => category.units.find((unit) => unit.id === id) ?? null;

export function convert(value, categoryId, fromId, toId) {
  if (!Number.isFinite(value)) return null;
  const category = findCategory(categoryId);
  if (!category) return null;
  const from = findUnit(category, fromId);
  const to = findUnit(category, toId);
  if (!from || !to) return null;
  if (category.id === 'temperature') return to.fromBase(from.toBase(value));
  return (value * from.factor) / to.factor;
}
