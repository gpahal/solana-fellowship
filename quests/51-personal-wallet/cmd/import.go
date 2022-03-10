package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

// importCmd represents the import command
var importCmd = &cobra.Command{
	Use:   "importWallet",
	Short: "Import an existing wallet",
	Long:  "Import and existing wallet from a private key.",

	Args: cobra.ExactArgs(1),

	RunE: func(cmd *cobra.Command, args []string) error {
		filename := strings.TrimSpace(args[0])
		wallet, err := importWallet(filename, devnetRPCEndpoint)
		if err != nil {
			return err
		}

		fmt.Println("Public Key: " + wallet.account.PublicKey.ToBase58())
		balance, err := wallet.getBalance()
		if err != nil {
			return err
		}

		fmt.Printf("Balance: %s\n", fmtLamports(balance))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(importCmd)
}
