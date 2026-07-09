package sync

import (
	"encoding/json"
	"p2p/pkg/versioning"
)

func serializeVectorClock(vc *versioning.VectorClock) (string, error) {
	if vc == nil {
		return "{}", nil
	}
	data, err := json.Marshal(vc.AsMap())
	if err != nil {
		return "{}", err
	}
	return string(data), nil
}

func deserializeVectorClock(data string) *versioning.VectorClock {
	vc := versioning.NewVectorClock()
	if data == "" || data == "{}" {
		return vc
	}
	m := make(map[string]uint64)
	json.Unmarshal([]byte(data), &m)
	vc.Merge(m)
	return vc
}
