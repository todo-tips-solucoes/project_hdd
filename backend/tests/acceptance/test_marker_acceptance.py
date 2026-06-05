from hdd.domain.marker import VERSION


def test_marker_version_is_string():
    assert isinstance(VERSION, str)


def test_marker_version_is_not_empty():
    assert VERSION != ''
