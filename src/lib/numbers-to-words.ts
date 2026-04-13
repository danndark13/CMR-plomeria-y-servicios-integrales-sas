
export function convertNumberToSpanishWords(n: number): string {
  const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const DIECI = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const VEINTI = ['VEINTE', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function getCentenas(num: number): string {
    const c = Math.floor(num / 100);
    const d = Math.floor((num % 100) / 10);
    const u = num % 10;

    if (num === 100) return 'CIEN';
    const sDecenas = getDecenas(num % 100);
    return (CENTENAS[c] + ' ' + sDecenas).trim();
  }

  function getDecenas(num: number): string {
    if (num < 10) return UNIDADES[num];
    if (num >= 10 && num < 20) return DIECI[num - 10];
    if (num >= 20 && num < 30) return VEINTI[num - 20];
    
    const d = Math.floor(num / 10);
    const u = num % 10;
    if (u === 0) return DECENAS[d];
    return DECENAS[d] + ' Y ' + UNIDADES[u];
  }

  function getMiles(num: number): string {
    const miles = Math.floor(num / 1000);
    const resto = num % 1000;
    
    let sMiles = '';
    if (miles === 1) sMiles = 'MIL';
    else if (miles > 1) sMiles = getCentenas(miles) + ' MIL';
    
    const sResto = getCentenas(resto);
    return (sMiles + ' ' + sResto).trim();
  }

  function getMillones(num: number): string {
    const millones = Math.floor(num / 1000000);
    const resto = num % 1000000;
    
    let sMillones = '';
    if (millones === 1) sMillones = 'UN MILLON';
    else if (millones > 1) sMillones = getCentenas(millones) + ' MILLONES';
    
    const sResto = getMiles(resto);
    return (sMillones + ' ' + sResto).trim();
  }

  if (n === 0) return 'CERO';
  if (n < 0) return 'MENOS ' + convertNumberToSpanishWords(Math.abs(n));
  
  const totalStr = getMillones(n);
  return totalStr + ' PESOS M/CTE';
}
