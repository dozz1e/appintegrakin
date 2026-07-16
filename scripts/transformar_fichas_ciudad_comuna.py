# Script de carga única de fichas.xlsx (ciudad/comuna de clientes).
# Ejecutado 2026-07-15 contra /run/media/Respaldo/Oz/Escritorio/fichas.xlsx
# (convertido antes a fichas.csv con `libreoffice --headless --convert-to csv`).
# Ver docs/superpowers/specs/2026-07-15-clientes-ciudad-comuna-design.md
# y docs/superpowers/plans/2026-07-15-clientes-ciudad-comuna.md (Task 3).
# Se conserva como referencia para una futura carga similar, no se re-ejecuta
# automáticamente ni es parte del build de la app.

import csv
import json

MINUSCULAS = {'de', 'del', 'la', 'las', 'los', 'y'}

def capitalizar_es(texto):
    texto = texto.strip()
    if not texto:
        return texto
    palabras = texto.lower().split()
    out = []
    for i, p in enumerate(palabras):
        if i > 0 and p in MINUSCULAS:
            out.append(p)
        else:
            out.append(p[0].upper() + p[1:] if p else p)
    return ' '.join(out)

def valor_o_vacio(campo):
    t = (campo or '').strip()
    if t == '' or t == '.':
        return None
    return t

rows_by_rut = {}
order = []

with open('fichas.csv', newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        rut = row['Rut'].strip()
        if not rut:
            continue
        if rut not in rows_by_rut:
            order.append(rut)
        rows_by_rut[rut] = row  # última ocurrencia gana

records = []
for rut in order:
    row = rows_by_rut[rut]
    nombre = valor_o_vacio(row['Nombre'])
    direccion = valor_o_vacio(row['Dirección'])
    telefono = valor_o_vacio(row['Teléfono'])
    email = valor_o_vacio(row['E-mail'])
    comuna = valor_o_vacio(row['Comuna'])
    ciudad = valor_o_vacio(row['Ciudad'])

    if nombre is not None:
        nombre = capitalizar_es(nombre)
    if direccion is not None:
        direccion = capitalizar_es(direccion)
    if comuna is not None:
        comuna = capitalizar_es(comuna)
    if ciudad is not None:
        ciudad = capitalizar_es(ciudad)
    if email is not None:
        email = email.strip().lower()
    if telefono is not None:
        telefono = telefono.strip()

    records.append({
        'rut': rut,
        'razon_social': nombre,
        'direccion': direccion,
        'telefono': telefono,
        'email': email,
        'comuna': comuna,
        'ciudad': ciudad,
    })

print(f"Total registros unicos: {len(records)}")

with open('fichas_staging.json', 'w', encoding='utf-8') as out:
    json.dump(records, out, ensure_ascii=False)
print(f"fichas_staging.json: {len(records)} filas")
