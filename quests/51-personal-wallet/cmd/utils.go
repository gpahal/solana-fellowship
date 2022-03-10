package cmd

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"math"
	"strconv"
	"strings"

	"github.com/portto/solana-go-sdk/client"
	"github.com/portto/solana-go-sdk/common"
	"github.com/portto/solana-go-sdk/program/sysprog"
	"github.com/portto/solana-go-sdk/rpc"
	"github.com/portto/solana-go-sdk/types"
)

type rpcEndpoint string

const (
	devnetRPCEndpoint rpcEndpoint = rpc.DevnetRPCEndpoint
)

type wallet struct {
	account types.Account
	c       *client.Client
}

func saveAccount(account types.Account) error {
	data := []byte(account.PrivateKey)
	return ioutil.WriteFile("data", data, 0644)
}

func saveWallet(account types.Account, endpoint rpcEndpoint) (*wallet, error) {
	err := saveAccount(account)
	if err != nil {
		return nil, err
	}

	return &wallet{
		account,
		client.NewClient(string(endpoint)),
	}, nil
}

func loadAccountFromFile(filename string) (types.Account, error) {
	privateKey, err := ioutil.ReadFile(filename)
	if err != nil {
		return types.Account{}, err
	}

	return types.AccountFromBytes(privateKey)
}

func loadAccount() (types.Account, error) {
	return loadAccountFromFile("data")
}

func loadWallet(endpoint rpcEndpoint) (*wallet, error) {
	account, err := loadAccount()
	if err != nil {
		return nil, err
	}

	return &wallet{
		account,
		client.NewClient(string(endpoint)),
	}, nil
}

func createNewWallet(rpcEndpoint rpcEndpoint) (*wallet, error) {
	account := types.NewAccount()
	return saveWallet(account, rpcEndpoint)
}

func importWallet(filename string, rpcEndpoint rpcEndpoint) (*wallet, error) {
	account, err := loadAccountFromFile(filename)
	if err != nil {
		return nil, err
	}

	return saveWallet(account, rpcEndpoint)
}

func (w *wallet) getBalance() (uint64, error) {
	return w.c.GetBalance(context.Background(), w.account.PublicKey.ToBase58())
}

func (w *wallet) requestAirdrop(lamports uint64) (string, error) {
	return w.c.RequestAirdrop(context.Background(), w.account.PublicKey.ToBase58(), lamports)
}

func (w *wallet) transfer(to string, lamports uint64) (string, error) {
	recentBlockhashResponse, err := w.c.GetRecentBlockhash(context.Background())
	if err != nil {
		return "", err
	}

	toPublicKey := common.PublicKeyFromString(to)
	if !common.IsOnCurve(toPublicKey) {
		return "", fmt.Errorf("invalid public key: %s", to)
	}

	message := types.NewMessage(types.NewMessageParam{
		FeePayer: w.account.PublicKey,
		Instructions: []types.Instruction{
			sysprog.Transfer(sysprog.TransferParam{
				From:   w.account.PublicKey,
				To:     toPublicKey,
				Amount: lamports,
			}),
		},
		RecentBlockhash: recentBlockhashResponse.Blockhash,
	})
	tx, err := types.NewTransaction(types.NewTransactionParam{
		Signers: []types.Account{w.account},
		Message: message,
	})
	if err != nil {
		return "", err
	}

	return w.c.SendTransaction(context.Background(), tx)
}

func fmtLamports(lamports uint64) string {
	if lamports < 5*1e7 {
		if lamports == 0 {
			return "0 SOL"
		} else if lamports < 1*1e5 {
			return fmt.Sprintf("%d LAMPORTS", lamports)
		}
		fractionStr := trimZeroes(fmt.Sprintf("%04d", lamports/1e5))
		return fmt.Sprintf("0.%s SOL", fractionStr)
	} else {
		whole, fraction := lamports/1e9, (lamports%1e9)/1e7
		if fraction == 0 {
			return fmt.Sprintf("%d SOL", whole)
		}
		fractionStr := trimZeroes(fmt.Sprintf("%02d", fraction))
		return fmt.Sprintf("%d.%s SOL", whole, fractionStr)
	}
}

func parseSolToLamports(s string) (uint64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, errors.New("empty sol value")
	}

	parts := strings.Split(s, ".")
	if len(parts) == 0 || len(parts) > 2 {
		return 0, fmt.Errorf("invalid sol value: %s", s)
	}

	if len(parts) == 1 {
		whole, err := strconv.ParseUint(parts[0], 10, 64)
		if err != nil {
			return 0, err
		}
		return whole * 1e9, nil
	}

	var err error
	var whole uint64
	if parts[0] == "" {
		whole = 0
	} else {
		whole, err = strconv.ParseUint(parts[0], 10, 64)
		if err != nil {
			return 0, err
		}
	}

	var fraction uint64
	if parts[1] == "" {
		fraction = 0
	} else {
		fraction, err = strconv.ParseUint(parts[1], 10, 64)
		if err != nil {
			return 0, err
		}
		if fraction == 0 {
			return whole * 1e9, nil
		}
	}

	leftZeroes := countLeftZeroes(parts[1])
	fractionWidth := 1 + int(math.Log10(float64(fraction)))
	if leftZeroes+fractionWidth > 9 {
		return 0, fmt.Errorf("invalid sol value: decimal part too long: %s", s)
	}

	extraZeroesNeeded := 9 - leftZeroes - fractionWidth
	if extraZeroesNeeded > 0 {
		fraction, err = strconv.ParseUint(fmt.Sprintf("%d%0*d", fraction, 9-leftZeroes-fractionWidth, 0), 10, 64)
		if err != nil {
			return 0, err
		}
	}

	return whole*1e9 + fraction, nil
}

func countLeftZeroes(s string) int {
	count := 0
	for _, c := range s {
		if c == '0' {
			count++
		} else {
			break
		}
	}
	return count
}

func trimZeroes(s string) string {
	i := len(s) - 1
	for ; i >= 0; i-- {
		if s[i] != '0' {
			return s[:i+1]
		}
	}
	return ""
}
