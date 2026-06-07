with open('utils/test-presets.ps1', 'r', encoding='utf-8') as f:
    text = f.read()

in_sq = False
in_dq = False
for c in text:
    if c == "'":
        if not in_dq:
            in_sq = not in_sq
    elif c == '"':
        if not in_sq:
            in_dq = not in_dq

print('Single:', in_sq, 'Double:', in_dq)
