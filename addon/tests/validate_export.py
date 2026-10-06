"""Character Export v1 JSON을 스키마로 검증한다. (오프라인 하네스 출력용)

사용: python validate_export.py <schema.json> <export.json>...
jsonschema 패키지가 필요하다.
"""
import json
import sys

from jsonschema import Draft202012Validator

schema = json.load(open(sys.argv[1], encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)
failed = False


def find_nulls(value, path="$"):
    if value is None:
        yield path
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from find_nulls(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from find_nulls(item, f"{path}[{index}]")


for path in sys.argv[2:]:
    data = json.load(open(path, encoding="utf-8"))
    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
    nulls = list(find_nulls(data))
    for error in errors:
        print(f"  FAIL {path}: {list(error.path)} {error.message}")
    for null in nulls:
        print(f"  FAIL {path}: null 값이 있음 {null} (얻지 못한 값은 키를 생략해야 함)")
    if errors or nulls:
        failed = True
    else:
        print(f"  ok   {path}: 스키마 검증 통과")

sys.exit(1 if failed else 0)
